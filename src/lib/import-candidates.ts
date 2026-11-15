/**
 * Import candidates — the pure half of `POST /api/cron/import-candidates`.
 *
 * Xavier approved (15 Nov 2026) preparing two targeted import batches — family
 * TV series available in France, and games popular in France that we lack —
 * for review title by title. The route fetches (TMDB / IGDB, read-only); this
 * module decides, deterministically and testably, what qualifies, how it ranks
 * and what is already in `media_items`. Nothing here touches the network or the
 * database.
 *
 * Selection is demand-led, never "whatever discover returns":
 *  - séries : streamable in France on a family-relevant platform (TMDB watch
 *    providers, region FR), Kids/Family genre (Animation-only titles are kept
 *    but tagged « à vérifier »), a vote floor, already aired, no adult signal.
 *  - jeux   : released on a platform French families play on, a rating-count
 *    floor, PEGI ≤ 16 (PEGI 18 excluded; no PEGI = « à vérifier » with a higher
 *    floor), no DLC / edition, no adult signal.
 * Dedup: (tmdb_id, type='TV') for series, igdb_id for games. A normalized-title
 * match against an existing fiche of the same type is reported, not dropped:
 * it is usually a different id for the same work and needs a human eye.
 */
import { isAdultIgdbGame, isAdultTmdbTv } from "@/lib/adult-content-filter"
import { getPegiInfo, type IGDBGame } from "@/lib/igdb"
import type { TMDBTVShow, TMDBWatchProvider } from "@/lib/tmdb"

// ── Shared ────────────────────────────────────────────────────────────

export type CandidateTier = "core" | "a-verifier"

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|le|la|les|l)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Parse an explicit, approved id list: "12,34, 56" → [12, 34, 56]. Anything else is refused. */
export function parseApprovedIds(raw: string | null, max: number): { ids: number[]; error?: string } {
  if (!raw || raw.trim() === "") return { ids: [], error: "liste d'identifiants vide" }
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.some((p) => !/^\d{1,9}$/.test(p))) {
    return { ids: [], error: "identifiants attendus : entiers séparés par des virgules" }
  }
  const ids = [...new Set(parts.map(Number))].filter((n) => n > 0)
  if (ids.length > max) return { ids: [], error: `au plus ${max} identifiants par appel` }
  return { ids }
}

// ── Séries ────────────────────────────────────────────────────────────

export const TV_GENRE = {
  ANIMATION: 16,
  CRIME: 80,
  FAMILY: 10751,
  KIDS: 10762,
  NEWS: 10763,
  REALITY: 10764,
  SOAP: 10766,
  TALK: 10767,
  WAR_POLITICS: 10768,
} as const

export const TV_THRESHOLDS = {
  /** Kids / Family lane: platform presence in FR already filters a lot. */
  coreMinVotes: 10,
  /** Animation-only lane (no Kids/Family tag): adult animation lives here. */
  animationMinVotes: 100,
  /** Discovery pages per platform group and lane (20 results / page). */
  corePagesPerPlatform: 6,
  animationPagesPerPlatform: 2,
  defaultLimit: 300,
  maxLimit: 500,
} as const

/** Genres that disqualify a series for this batch, whatever else it carries. */
export const TV_EXCLUDED_GENRES: readonly number[] = [
  TV_GENRE.CRIME,
  TV_GENRE.NEWS,
  TV_GENRE.SOAP,
  TV_GENRE.TALK,
  TV_GENRE.WAR_POLITICS,
]

/**
 * The French platforms of the batch. TMDB/JustWatch names drift (MYTF1 → TF1+,
 * 6play → M6+, France TV → france.tv), so each is a pattern, resolved to ids
 * at run time against `/watch/providers/tv?watch_region=FR`.
 */
export const FR_TV_PLATFORMS: readonly { label: string; match: RegExp }[] = [
  { label: "Netflix", match: /^netflix\b/i },
  { label: "Disney+", match: /^disney\s*(\+|plus)/i },
  { label: "Prime Video", match: /^amazon prime video$/i },
  { label: "TF1+", match: /^(tf1|mytf1)/i },
  { label: "France TV", match: /^france\s*\.?\s*tv/i },
  { label: "Canal+", match: /^(canal\s*\+|mycanal)/i },
  { label: "M6+", match: /^(m6\s*\+|6play)/i },
]

export interface PlatformGroup {
  label: string
  providerIds: number[]
  providerNames: string[]
}

/** Map TMDB's FR provider list to our platform groups. Channel add-ons ("… Amazon Channel") are left out. */
export function resolveFrPlatformGroups(providers: TMDBWatchProvider[]): PlatformGroup[] {
  return FR_TV_PLATFORMS.map(({ label, match }) => {
    const hits = providers.filter(
      (p) => match.test(p.provider_name.trim()) && !/channel/i.test(p.provider_name),
    )
    return {
      label,
      providerIds: [...new Set(hits.map((p) => p.provider_id))],
      providerNames: [...new Set(hits.map((p) => p.provider_name))],
    }
  })
}

export type TvLane = "core" | "animation"

export interface TvDiscoverPage {
  platform: string
  lane: TvLane
  results: TMDBTVShow[]
}

export interface TvCandidate {
  tmdbId: number
  title: string
  originalTitle: string | null
  year: number | null
  platforms: string[]
  genreIds: number[]
  originalLanguage: string
  voteCount: number
  popularity: number
  tier: CandidateTier
  why: string
  score: number
  possibleDuplicateOf?: string
}

export type TvRejectReason = "excluded-genre" | "not-family-genre" | "low-votes" | "not-aired" | "adult"

/** Merge every discover page into one row per show, keeping the union of platforms. */
export function mergeTvPages(pages: TvDiscoverPage[]): Map<number, { show: TMDBTVShow; platforms: Set<string>; lanes: Set<TvLane> }> {
  const byId = new Map<number, { show: TMDBTVShow; platforms: Set<string>; lanes: Set<TvLane> }>()
  for (const page of pages) {
    for (const show of page.results) {
      if (typeof show?.id !== "number") continue
      const row = byId.get(show.id) ?? { show, platforms: new Set<string>(), lanes: new Set<TvLane>() }
      row.platforms.add(page.platform)
      row.lanes.add(page.lane)
      byId.set(show.id, row)
    }
  }
  return byId
}

function yearOf(date: string | null | undefined): number | null {
  if (!date) return null
  const y = Number(date.slice(0, 4))
  return Number.isFinite(y) && y > 1900 ? y : null
}

export function qualifyTvShow(
  show: TMDBTVShow,
  today: string,
): { ok: true; tier: CandidateTier } | { ok: false; reason: TvRejectReason } {
  const genres = show.genre_ids ?? []
  if (isAdultTmdbTv(show)) return { ok: false, reason: "adult" }
  if (genres.some((g) => TV_EXCLUDED_GENRES.includes(g))) return { ok: false, reason: "excluded-genre" }
  if (!show.first_air_date || show.first_air_date > today) return { ok: false, reason: "not-aired" }

  const familyTagged = genres.includes(TV_GENRE.KIDS) || genres.includes(TV_GENRE.FAMILY)
  if (familyTagged) {
    return (show.vote_count ?? 0) >= TV_THRESHOLDS.coreMinVotes
      ? { ok: true, tier: "core" }
      : { ok: false, reason: "low-votes" }
  }
  if (genres.includes(TV_GENRE.ANIMATION)) {
    return (show.vote_count ?? 0) >= TV_THRESHOLDS.animationMinVotes
      ? { ok: true, tier: "a-verifier" }
      : { ok: false, reason: "low-votes" }
  }
  return { ok: false, reason: "not-family-genre" }
}

/**
 * Ranking: demand first (TMDB popularity + votes, log-scaled so one global hit
 * doesn't crush the list), then breadth of French availability, then a nudge
 * for Kids-tagged and French-language series. Animation-only (« à vérifier »)
 * always ranks below the Kids/Family lane.
 */
export function scoreTvCandidate(c: Pick<TvCandidate, "popularity" | "voteCount" | "platforms" | "genreIds" | "originalLanguage" | "tier">): number {
  let s = Math.log10(1 + Math.max(0, c.popularity)) * 10 + Math.log10(1 + Math.max(0, c.voteCount)) * 5
  s += c.platforms.length * 3
  if (c.genreIds.includes(TV_GENRE.KIDS)) s += 5
  if (c.originalLanguage === "fr") s += 5
  if (c.tier === "a-verifier") s -= 25
  return Math.round(s * 10) / 10
}

function tvWhy(platforms: string[], genreIds: number[], tier: CandidateTier, voteCount: number, lang: string): string {
  const g: string[] = []
  if (genreIds.includes(TV_GENRE.KIDS)) g.push("Jeunesse")
  if (genreIds.includes(TV_GENRE.FAMILY)) g.push("Familial")
  if (genreIds.includes(TV_GENRE.ANIMATION)) g.push("Animation")
  const parts = [`dispo. FR : ${platforms.join(", ")}`, `genres : ${g.join(", ") || "—"}`, `${voteCount} votes`]
  if (lang === "fr") parts.push("production francophone")
  if (tier === "a-verifier") parts.push("à vérifier : animation sans tag Jeunesse/Familial")
  return parts.join(" · ")
}

export interface TvSelectionStats {
  discovered: number
  alreadyInCatalogue: number
  rejected: Record<TvRejectReason, number>
  qualified: number
  returned: number
  coreReturned: number
  titleMatches: number
}

export function selectTvCandidates(args: {
  pages: TvDiscoverPage[]
  existingTmdbIds: Set<number>
  /** normalized title → existing fiche title, same type (TV). */
  existingTitles: Map<string, string>
  today: string
  limit: number
}): { candidates: TvCandidate[]; stats: TvSelectionStats } {
  const merged = mergeTvPages(args.pages)
  const stats: TvSelectionStats = {
    discovered: merged.size,
    alreadyInCatalogue: 0,
    rejected: { "excluded-genre": 0, "not-family-genre": 0, "low-votes": 0, "not-aired": 0, adult: 0 },
    qualified: 0,
    returned: 0,
    coreReturned: 0,
    titleMatches: 0,
  }
  const out: TvCandidate[] = []
  for (const [id, { show, platforms }] of merged) {
    if (args.existingTmdbIds.has(id)) {
      stats.alreadyInCatalogue++
      continue
    }
    const q = qualifyTvShow(show, args.today)
    if (!q.ok) {
      stats.rejected[q.reason]++
      continue
    }
    const plats = FR_TV_PLATFORMS.map((p) => p.label).filter((l) => platforms.has(l))
    const base = {
      tmdbId: id,
      title: show.name,
      originalTitle: show.original_name && show.original_name !== show.name ? show.original_name : null,
      year: yearOf(show.first_air_date),
      platforms: plats,
      genreIds: show.genre_ids ?? [],
      originalLanguage: show.original_language ?? "",
      voteCount: show.vote_count ?? 0,
      popularity: show.popularity ?? 0,
      tier: q.tier,
    }
    const dup =
      args.existingTitles.get(normalizeTitle(show.name)) ??
      (show.original_name ? args.existingTitles.get(normalizeTitle(show.original_name)) : undefined)
    out.push({
      ...base,
      why: tvWhy(plats, base.genreIds, q.tier, base.voteCount, base.originalLanguage),
      score: scoreTvCandidate(base),
      ...(dup ? { possibleDuplicateOf: dup } : {}),
    })
  }
  stats.qualified = out.length
  out.sort((a, b) => b.score - a.score || a.tmdbId - b.tmdbId)
  const candidates = out.slice(0, Math.max(0, args.limit))
  stats.returned = candidates.length
  stats.coreReturned = candidates.filter((c) => c.tier === "core").length
  stats.titleMatches = candidates.filter((c) => c.possibleDuplicateOf).length
  return { candidates, stats }
}

// ── Jeux ──────────────────────────────────────────────────────────────

export const GAME_THRESHOLDS = {
  /** With a PEGI rating (= released in Europe). */
  minRatingsWithPegi: 30,
  /** PEGI 3 / 7: kids' games collect fewer ratings. */
  minRatingsFamilyPegi: 10,
  /** No PEGI on IGDB (frequent for mobile): stricter, and tagged « à vérifier ». */
  minRatingsWithoutPegi: 100,
  maxPegi: 16,
  pagesPerLane: 2, // × 500
  trendingIds: 200,
  defaultLimit: 150,
  maxLimit: 300,
} as const

/** IGDB platform id → short label, for the platforms French families play on. */
export const FR_GAME_PLATFORMS: Record<number, string> = {
  130: "Switch",
  508: "Switch 2",
  167: "PS5",
  48: "PS4",
  169: "Xbox Series",
  49: "Xbox One",
  6: "PC",
  39: "iOS",
  34: "Android",
}

export interface GameCandidate {
  igdbId: number
  title: string
  year: number | null
  pegi: number | null
  platforms: string[]
  ratingCount: number
  trending: boolean
  tier: CandidateTier
  why: string
  score: number
  possibleDuplicateOf?: string
}

export type GameRejectReason = "adult" | "pegi-18" | "no-fr-platform" | "low-ratings" | "unreleased"

export function qualifyGame(
  game: IGDBGame,
  nowSec: number,
): { ok: true; tier: CandidateTier; pegi: number | null; platforms: string[] } | { ok: false; reason: GameRejectReason } {
  if (isAdultIgdbGame(game)) return { ok: false, reason: "adult" }
  const pegi = getPegiInfo(game.age_ratings)?.age ?? null
  if (pegi !== null && pegi > GAME_THRESHOLDS.maxPegi) return { ok: false, reason: "pegi-18" }
  if (!game.first_release_date || game.first_release_date > nowSec) return { ok: false, reason: "unreleased" }
  const platforms = [
    ...new Set(
      (game.platforms ?? [])
        .map((p) => FR_GAME_PLATFORMS[p.id])
        .filter((l): l is string => Boolean(l)),
    ),
  ]
  if (platforms.length === 0) return { ok: false, reason: "no-fr-platform" }
  const count = game.total_rating_count ?? 0
  if (pegi === null) {
    return count >= GAME_THRESHOLDS.minRatingsWithoutPegi
      ? { ok: true, tier: "a-verifier", pegi, platforms }
      : { ok: false, reason: "low-ratings" }
  }
  const floor = pegi <= 7 ? GAME_THRESHOLDS.minRatingsFamilyPegi : GAME_THRESHOLDS.minRatingsWithPegi
  return count >= floor ? { ok: true, tier: "core", pegi, platforms } : { ok: false, reason: "low-ratings" }
}

/**
 * Ranking: lifetime notoriety (rating count, log-scaled) + "played / wanted
 * right now" (IGDB popularity primitives) + a family nudge for PEGI 3/7, a
 * smaller one for PEGI 12, and Switch / phones (the family platforms).
 * No-PEGI titles rank below rated ones.
 */
export function scoreGameCandidate(c: Pick<GameCandidate, "ratingCount" | "trending" | "pegi" | "platforms" | "tier">): number {
  let s = Math.log10(1 + Math.max(0, c.ratingCount)) * 10
  if (c.trending) s += 12
  if (c.pegi !== null && c.pegi <= 7) s += 8
  else if (c.pegi === 12) s += 4
  if (c.platforms.includes("Switch") || c.platforms.includes("Switch 2")) s += 3
  if (c.platforms.includes("iOS") || c.platforms.includes("Android")) s += 2
  if (c.tier === "a-verifier") s -= 15
  return Math.round(s * 10) / 10
}

function gameWhy(c: Pick<GameCandidate, "pegi" | "platforms" | "ratingCount" | "trending" | "tier">): string {
  const parts = [
    c.pegi !== null ? `PEGI ${c.pegi}` : "PEGI inconnu",
    c.platforms.join(", "),
    `${c.ratingCount} notes`,
  ]
  if (c.trending) parts.push("tendance actuelle")
  if (c.tier === "a-verifier") parts.push("à vérifier : pas de PEGI sur la source")
  return parts.join(" · ")
}

export interface GameSelectionStats {
  discovered: number
  alreadyInCatalogue: number
  rejected: Record<GameRejectReason, number>
  qualified: number
  returned: number
  coreReturned: number
  titleMatches: number
}

export function selectGameCandidates(args: {
  games: IGDBGame[]
  trendingIds: Set<number>
  existingIgdbIds: Set<number>
  /** normalized title → existing fiche title, same type (GAME). */
  existingTitles: Map<string, string>
  nowSec: number
  limit: number
}): { candidates: GameCandidate[]; stats: GameSelectionStats } {
  const byId = new Map<number, IGDBGame>()
  for (const g of args.games) if (typeof g?.id === "number" && !byId.has(g.id)) byId.set(g.id, g)
  const stats: GameSelectionStats = {
    discovered: byId.size,
    alreadyInCatalogue: 0,
    rejected: { adult: 0, "pegi-18": 0, "no-fr-platform": 0, "low-ratings": 0, unreleased: 0 },
    qualified: 0,
    returned: 0,
    coreReturned: 0,
    titleMatches: 0,
  }
  const out: GameCandidate[] = []
  for (const [id, game] of byId) {
    if (args.existingIgdbIds.has(id)) {
      stats.alreadyInCatalogue++
      continue
    }
    const q = qualifyGame(game, args.nowSec)
    if (!q.ok) {
      stats.rejected[q.reason]++
      continue
    }
    const base = {
      igdbId: id,
      title: game.name,
      year: game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : null,
      pegi: q.pegi,
      platforms: q.platforms,
      ratingCount: game.total_rating_count ?? 0,
      trending: args.trendingIds.has(id),
      tier: q.tier,
    }
    const dup = args.existingTitles.get(normalizeTitle(game.name))
    out.push({
      ...base,
      why: gameWhy(base),
      score: scoreGameCandidate(base),
      ...(dup ? { possibleDuplicateOf: dup } : {}),
    })
  }
  stats.qualified = out.length
  out.sort((a, b) => b.score - a.score || a.igdbId - b.igdbId)
  const candidates = out.slice(0, Math.max(0, args.limit))
  stats.returned = candidates.length
  stats.coreReturned = candidates.filter((c) => c.tier === "core").length
  stats.titleMatches = candidates.filter((c) => c.possibleDuplicateOf).length
  return { candidates, stats }
}

/** Build the title index used for the soft duplicate check. */
export function buildTitleIndex(rows: { title: string; originalTitle?: string | null }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) {
    for (const t of [r.title, r.originalTitle]) {
      if (!t) continue
      const k = normalizeTitle(t)
      if (k && !map.has(k)) map.set(k, r.title)
    }
  }
  return map
}

/** Compact one-line rows for cron_logs.details (the full objects stay in the HTTP response). */
export function compactForLog(
  rows: (TvCandidate | GameCandidate)[],
  cap: number,
): string[] {
  return rows.slice(0, cap).map((c) => {
    const id = "tmdbId" in c ? `tmdb:${c.tmdbId}` : `igdb:${c.igdbId}`
    const orig = "originalTitle" in c && c.originalTitle ? ` / ${c.originalTitle}` : ""
    const dup = c.possibleDuplicateOf ? ` · doublon possible : ${c.possibleDuplicateOf}` : ""
    return `${id} · ${c.title}${orig} (${c.year ?? "?"}) · ${c.why}${dup}`
  })
}
