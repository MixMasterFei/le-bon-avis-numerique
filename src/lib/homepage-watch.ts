/**
 * homepage-watch — the agent that checks, every two days, that the homepage
 * shows what families are talking about this week (pure part, tested).
 *
 * It builds an EXPECTED list (French cinema now_playing + releases ≤ 7 days,
 * TMDB trending films / series of the week that are relevant in France, IGDB
 * trending + fresh game releases, titles of our latest news stories), reads
 * what the V2 homepage ACTUALLY shows by calling the same selection functions
 * the page uses (spotlight band, cinema rail, games rail at the default age
 * cap), then classifies every expected title:
 *
 *   on-homepage  shown, with its section and position
 *   missing      not in the catalogue (→ import, autofix)
 *   not-ready    in the catalogue without an age, or not analysed yet
 *   age-capped   analysed, but above the rail's default age cap (12, cinema 14)
 *                so the browse rails can never show it — the spotlight band
 *                is the only place it can appear (→ pin, autofix)
 *   absent       analysed, within the cap, yet nowhere on the homepage (→ pin)
 *
 * Writes (imports, pins) happen in `homepage-watch-run.ts`. Nothing here
 * produces or changes an age: imports go through the existing import
 * functions, and the band reads ages from the catalogue.
 */

import { isShowable, interleaveByType } from "@/lib/homepage-spotlight"
import { verdictLine } from "@/lib/agent-verdict"

export type WatchKind = "MOVIE" | "TV" | "GAME"

export type ExpectedSource =
  | "cinema"
  | "cinema-soon"
  | "trending-movie"
  | "trending-tv"
  | "igdb-trending"
  | "igdb-fresh"
  | "news"

export const SOURCE_LABELS: Record<ExpectedSource, string> = {
  cinema: "à l'affiche",
  "cinema-soon": "sort sous 7 jours",
  "trending-movie": "film en tendance",
  "trending-tv": "série en tendance",
  "igdb-trending": "jeu en tendance",
  "igdb-fresh": "jeu sorti récemment",
  news: "dans nos actualités",
}

export interface ExpectedItem {
  /** "MOVIE:tmdb:123" · "TV:tmdb:45" · "GAME:igdb:52189" · "media:<uuid>" (news). */
  key: string
  kind: WatchKind
  title: string
  sources: ExpectedSource[]
  /** 0–100: how strongly this title is « of the week » (rank-derived). */
  signal: number
  tmdbId?: number
  igdbId?: number
  mediaId?: string
  /** Relevant in France (in French cinemas, on a French platform, French…). Gates imports. */
  frRelevant: boolean
  /**
   * A launch THIS period: film in cinemas or out within 7 days, series that
   * premiered or got a new season recently, game released recently. Only
   * these are pinned to the band — an evergreen trending title is not news.
   */
  isNew: boolean
  /** Short human note for the report / pin reason (« saison 2 le 12 nov. »). */
  note?: string
}

export interface CatalogueEntry {
  id: string
  kind: WatchKind
  title: string
  expertAgeRec: number | null
  isEnriched: boolean
  posterUrl: string | null
}

export type HomepageSection = "spotlight" | "cinema" | "games"

export const SECTION_LABELS: Record<HomepageSection, string> = {
  spotlight: "À ne pas manquer",
  cinema: "À l'affiche",
  games: "Jeux vidéo",
}

export interface HomepageSlot {
  section: HomepageSection
  /** 1-based position in that section. */
  position: number
  mediaId: string | null
  /** Cinema cards for films not in the catalogue yet carry only a TMDB id. */
  tmdbId?: number | null
}

export type WatchStatus = "on-homepage" | "missing" | "not-ready" | "age-capped" | "absent"

export interface ClassifiedItem extends ExpectedItem {
  status: WatchStatus
  entry: CatalogueEntry | null
  placements: Array<{ section: HomepageSection; position: number }>
  /** The default cap that applied (age-capped only). */
  cap?: number
}

/**
 * Default age caps of the V2 homepage when nobody picked an age:
 * `page.tsx` passes `defaultMaxAge={maxAgeCap ?? 12}` to every browse rail,
 * and `HomepageRedesign` gives the cinema rail `globalMaxAge ?? 14`.
 */
export const HOMEPAGE_DEFAULT_CAP = 12
export const HOMEPAGE_CINEMA_CAP = 14

/** Import at most this many missing titles per run (the brief: ~8). */
export const WATCH_MAX_IMPORTS = 8
/** Band pins written per run, and how long they live if the cron stops. */
export const WATCH_MAX_PINS = 8
export const WATCH_PIN_DAYS = 14
const WATCH_PINS_PER_KIND = 3

export function catalogueKey(kind: WatchKind, ids: { tmdbId?: number | null; igdbId?: number | null }): string | null {
  if (kind === "GAME") return ids.igdbId ? `GAME:igdb:${ids.igdbId}` : null
  return ids.tmdbId ? `${kind}:tmdb:${ids.tmdbId}` : null
}

/** Same title seen by several sources → one item, sources merged, strongest signal kept. */
export function mergeExpected(items: ExpectedItem[]): ExpectedItem[] {
  const byKey = new Map<string, ExpectedItem>()
  for (const item of items) {
    const prev = byKey.get(item.key)
    if (!prev) {
      byKey.set(item.key, { ...item, sources: [...item.sources] })
      continue
    }
    for (const s of item.sources) if (!prev.sources.includes(s)) prev.sources.push(s)
    prev.signal = Math.max(prev.signal, item.signal)
    prev.frRelevant = prev.frRelevant || item.frRelevant
    prev.isNew = prev.isNew || item.isNew
    prev.note = prev.note ?? item.note
    prev.mediaId = prev.mediaId ?? item.mediaId
  }
  return [...byKey.values()].sort((a, b) => b.signal - a.signal || a.title.localeCompare(b.title))
}

export function classifyExpected(
  expected: ExpectedItem[],
  catalogue: Map<string, CatalogueEntry>,
  homepage: HomepageSlot[],
  caps: { browse: number; cinema: number } = { browse: HOMEPAGE_DEFAULT_CAP, cinema: HOMEPAGE_CINEMA_CAP },
): ClassifiedItem[] {
  return expected.map((item) => {
    const entry = catalogue.get(item.key) ?? (item.mediaId ? catalogue.get(`media:${item.mediaId}`) : undefined) ?? null
    const placements = homepage
      .filter(
        (slot) =>
          (entry && slot.mediaId === entry.id) ||
          (item.kind === "MOVIE" && item.tmdbId != null && slot.tmdbId === item.tmdbId),
      )
      .map(({ section, position }) => ({ section, position }))
      .sort((a, b) => a.position - b.position)

    if (placements.length > 0) return { ...item, status: "on-homepage", entry, placements }
    if (!entry) return { ...item, status: "missing", entry, placements }
    if (entry.expertAgeRec == null || !entry.isEnriched) {
      return { ...item, status: "not-ready", entry, placements }
    }
    const cap = item.kind === "MOVIE" && item.sources.includes("cinema") ? caps.cinema : caps.browse
    if (entry.expertAgeRec > cap) return { ...item, status: "age-capped", entry, placements, cap }
    return { ...item, status: "absent", entry, placements }
  })
}

/** Missing AND relevant in France, strongest first, capped. */
export function pickImports(classified: ClassifiedItem[], max = WATCH_MAX_IMPORTS): ClassifiedItem[] {
  return classified
    .filter((c) => c.status === "missing" && c.frRelevant && (c.tmdbId != null || c.igdbId != null))
    .sort((a, b) => b.signal - a.signal)
    .slice(0, max)
}

export interface PinDraft {
  mediaId: string
  title: string
  kind: WatchKind
  rank: number
  reason: string
  startsAt: Date
  expiresAt: Date
}

/**
 * The week's launches already in the catalogue with an age and a poster, at
 * most three per kind, interleaved film / série / jeu, strongest first.
 * Titles that already hold an admin pin are left alone.
 */
export function buildWatchPins(
  classified: ClassifiedItem[],
  now: Date,
  opts: { adminPinnedIds?: Set<string>; max?: number; days?: number } = {},
): PinDraft[] {
  const max = opts.max ?? WATCH_MAX_PINS
  const days = opts.days ?? WATCH_PIN_DAYS
  const admin = opts.adminPinnedIds ?? new Set<string>()
  const eligible = classified
    .filter((c) => c.isNew && c.frRelevant && c.entry && isShowable(c.entry) && !admin.has(c.entry.id))
    .sort((a, b) => b.signal - a.signal)
  const perKind = (kind: WatchKind) => eligible.filter((c) => c.kind === kind).slice(0, WATCH_PINS_PER_KIND)
  const ordered = interleaveByType([perKind("MOVIE"), perKind("TV"), perKind("GAME")], max)
  const expiresAt = new Date(now.getTime() + days * 24 * 3_600_000)
  return ordered.map((c, rank) => ({
    mediaId: (c.entry as CatalogueEntry).id,
    title: (c.entry as CatalogueEntry).title,
    kind: c.kind,
    rank,
    reason: pinReason(c),
    startsAt: now,
    expiresAt,
  }))
}

function pinReason(c: ExpectedItem): string {
  const sources = c.sources.map((s) => SOURCE_LABELS[s]).join(", ")
  return (c.note ? `${sources} · ${c.note}` : sources).slice(0, 200)
}

// ── Report ────────────────────────────────────────────────────────────────

export interface SourceOutcome {
  ok: boolean
  count: number
  error?: string
}

export interface WatchOutcomes {
  dryRun: boolean
  /** Writes were allowed (production, kill switch not set, no ?dryRun=1). */
  writesEnabled: boolean
  sources: Record<string, SourceOutcome>
  homepageReadOk: boolean
  /** The catalogue lookup worked (without it, nothing can be classified). */
  catalogueReadOk: boolean
  /** `keys` = ExpectedItem keys actually created this run. */
  imports: { candidates: number; created: number; skipped: number; failed: number; keys: string[] }
  /** `tableMissing`: homepage_spotlight doesn't exist yet (migration 016) — nothing written, not a failure. */
  pins: { desired: number; written: number; failed: boolean; removed: number; error?: string; tableMissing?: boolean }
}

export type WatchHealth = "ok" | "sources-degraded" | "sources-failed" | "writes-failed"

export function watchHealth(o: WatchOutcomes): WatchHealth {
  const sources = Object.values(o.sources)
  if (sources.length === 0 || sources.every((s) => !s.ok) || !o.homepageReadOk || !o.catalogueReadOk) {
    return "sources-failed"
  }
  const pinAttempt = o.pins.desired > 0 && !o.pins.tableMissing
  const attempted = o.imports.created + o.imports.failed + (pinAttempt ? 1 : 0)
  const succeeded = o.imports.created + (pinAttempt && !o.pins.failed ? 1 : 0)
  if (o.writesEnabled && !o.dryRun && attempted > 0 && succeeded === 0) return "writes-failed"
  if (sources.some((s) => !s.ok)) return "sources-degraded"
  return "ok"
}

/** What still needs a human after this run (the verdict count). */
export function remainingWork(classified: ClassifiedItem[], o: WatchOutcomes, pinned: Set<string>) {
  const imported = new Set(o.imports.keys)
  const missing = classified.filter(
    (c) => c.status === "missing" && c.frRelevant && !imported.has(c.key),
  )
  const unshown = classified.filter(
    (c) =>
      (c.status === "absent" || c.status === "age-capped") &&
      c.isNew &&
      c.frRelevant &&
      !(c.entry && pinned.has(c.entry.id)),
  )
  return { missing, unshown }
}

function placementLabel(c: ClassifiedItem): string {
  return c.placements.map((p) => `${SECTION_LABELS[p.section]} n°${p.position}`).join(", ")
}

function line(c: ClassifiedItem, extra = ""): string {
  const age = c.entry?.expertAgeRec != null ? ` · ${c.entry.expertAgeRec === 0 ? "TP" : `${c.entry.expertAgeRec} ans`}` : ""
  const kind = c.kind === "MOVIE" ? "film" : c.kind === "TV" ? "série" : "jeu"
  const src = c.sources.map((s) => SOURCE_LABELS[s]).join(", ")
  return `  - ${c.title} (${kind}${age}) — ${src}${c.note ? ` · ${c.note}` : ""}${extra}`
}

export function buildWatchReport(input: {
  classified: ClassifiedItem[]
  outcomes: WatchOutcomes
  pins: PinDraft[]
  now: Date
}): { report: string; subject: string; health: WatchHealth; remaining: number } {
  const { classified, outcomes: o, pins } = input
  const health = watchHealth(o)
  const pinned = new Set(
    o.dryRun || !o.writesEnabled || o.pins.failed || o.pins.tableMissing ? [] : pins.map((p) => p.mediaId),
  )
  const { missing, unshown } = remainingWork(classified, o, pinned)
  const remaining = missing.length + unshown.length

  const by = (s: WatchStatus) => classified.filter((c) => c.status === s)
  const onHome = by("on-homepage")
  const lines: string[] = []

  let headline: string
  if (health === "sources-failed") {
    headline = "❌ ÉCHEC — les sources (ou la lecture de l'accueil) n'ont pas répondu : rien n'a été vérifié."
  } else if (health === "writes-failed") {
    headline = `❌ ÉCHEC DES ÉCRITURES — ${o.imports.failed} import(s) et les épingles ont échoué, rien n'a été corrigé.`
  } else if (remaining === 0) {
    headline = `✅ RIEN À FAIRE — les ${classified.length} titres de la semaine sont à l'accueil, en cours d'analyse ou hors périmètre.`
  } else {
    const top = missing[0] ?? unshown[0]
    headline = verdictLine({ count: remaining, kind: "action", top: top ? `« ${top.title} »` : undefined })
  }
  lines.push(headline)
  if (health === "sources-degraded") {
    lines.push("⚠️ Une partie des sources n'a pas répondu : la vérification est incomplète (détail plus bas).")
  }
  lines.push("")

  lines.push(
    `Mode : ${o.dryRun ? "simulation (?dryRun=1) — aucune écriture" : o.writesEnabled ? "correction automatique" : "rapport seul (HOMEPAGE_WATCH_AUTOFIX=false ou hors production)"}`,
  )
  lines.push(
    `Bilan : ${classified.length} titres attendus · ${onHome.length} à l'accueil · ${by("missing").length} absents du catalogue · ${by("not-ready").length} pas encore analysés · ${by("age-capped").length} écartés par le filtre d'âge par défaut (${HOMEPAGE_DEFAULT_CAP} ans, cinéma ${HOMEPAGE_CINEMA_CAP}) · ${by("absent").length} analysés mais absents de l'accueil`,
  )
  if (!o.dryRun && o.writesEnabled) {
    lines.push(
      `Écritures : ${o.imports.created} import(s) sur ${o.imports.candidates} tenté(s)${o.imports.failed ? ` (${o.imports.failed} en échec)` : ""} · ${
        o.pins.tableMissing
          ? "épingles non posées : table homepage_spotlight absente (migration 016 à appliquer)"
          : o.pins.failed
            ? `épingles en échec (${o.pins.error ?? "erreur"})`
            : `${o.pins.written} épingle(s) posée(s), ${o.pins.removed} retirée(s)`
      }`,
    )
  } else {
    lines.push(`Écritures prévues : ${o.imports.candidates} import(s), ${pins.length} épingle(s)`)
  }
  lines.push("")

  const section = (title: string, items: ClassifiedItem[], extra?: (c: ClassifiedItem) => string) => {
    if (items.length === 0) return
    lines.push(`${title} (${items.length})`)
    for (const c of items.slice(0, 12)) lines.push(line(c, extra ? extra(c) : ""))
    if (items.length > 12) lines.push(`  … et ${items.length - 12} autre(s)`)
    lines.push("")
  }

  section("Absents du catalogue", by("missing"), (c) =>
    o.imports.keys.includes(c.key) ? " → importé, en attente d'analyse" : c.frRelevant ? "" : " (hors France, ignoré)",
  )
  section("Au catalogue mais pas encore analysés / sans âge", by("not-ready"))
  section(
    `Écartés des rails par le filtre d'âge par défaut`,
    by("age-capped"),
    (c) => (pinned.has(c.entry?.id ?? "") ? " → épinglé dans « À ne pas manquer »" : ""),
  )
  section("Analysés mais absents de l'accueil", by("absent"), (c) =>
    pinned.has(c.entry?.id ?? "") ? " → épinglé dans « À ne pas manquer »" : "",
  )
  section("Déjà à l'accueil", onHome, (c) => ` → ${placementLabel(c)}`)

  if (pins.length > 0) {
    const written = !o.dryRun && o.writesEnabled && !o.pins.failed && !o.pins.tableMissing
    lines.push(`Épingles « À ne pas manquer » ${written ? "posées" : "proposées"} (expirent dans ${WATCH_PIN_DAYS} jours)`)
    for (const p of pins) lines.push(`  ${p.rank + 1}. ${p.title} — ${p.reason}`)
    lines.push("")
  }

  lines.push("Sources")
  for (const [name, s] of Object.entries(o.sources)) {
    lines.push(`  - ${name} : ${s.ok ? `${s.count} titre(s)` : `ÉCHEC${s.error ? ` (${s.error})` : ""}`}`)
  }
  lines.push(`  - lecture de l'accueil : ${o.homepageReadOk ? "ok" : "ÉCHEC"}`)

  const subject =
    health === "sources-failed"
      ? "Veille accueil — ÉCHEC : sources indisponibles"
      : health === "writes-failed"
        ? "Veille accueil — ÉCHEC des écritures"
        : remaining === 0
          ? "Veille accueil — rien à faire"
          : `Veille accueil — ${remaining} titre(s) de la semaine à traiter`
  return { report: lines.join("\n"), subject, health, remaining }
}
