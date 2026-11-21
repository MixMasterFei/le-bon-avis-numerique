/**
 * Picks the IGDB entry a curated seed (topGames.data.ts) actually means.
 *
 * IGDB's search is fuzzy: "among us" returns The Wolf Among Us, "clash
 * royale" returns whatever has "clash" in it. The old substring match then
 * declared The Wolf Among Us "already present" and Among Us was never
 * imported — and when nothing matched at all, the first fuzzy hit was
 * imported under the seed's name. Rules now:
 *
 *   - a candidate matches when its name IS an alias / catalogue title
 *     (tier 0), or STARTS with one followed by a separator (tier 1: editions
 *     and subtitles — "Toca Life: World", "LEGO Star Wars…", "FIFA 23"),
 *     after dropping a leading "the " / "tom clancy's " on the candidate;
 *   - no match means no pick: the caller reports the seed as not found
 *     instead of importing an unrelated game;
 *   - within a tier the most-rated entry wins (the mainline game, not a DLC);
 *   - a seed with `releasedFrom` only accepts entries released on or after
 *     that day. The Switch 2 remake of Ocarina of Time is named exactly like
 *     the 1998 original, so name matching alone would always import the
 *     original (the most-rated one) under the remake's seed.
 */

export interface GameSeedLike {
  name: string
  /** Lowercased title fragments, see topGames.data.ts. */
  aliases: readonly string[]
  /** Exact full titles, in editorial preference order. */
  catalogueTitles?: readonly string[]
  /**
   * YYYY-MM-DD. When set, only an entry first released on or after this day
   * can be picked — for a remake that carries its original's exact name.
   */
  releasedFrom?: string
}

export interface IgdbCandidateLike {
  id: number
  name?: string
  total_rating_count?: number
  /** Unix timestamp (seconds), as IGDB returns it. */
  first_release_date?: number
}

/**
 * False when the seed asks for a release window the candidate misses. A
 * candidate with no date never passes a window: "unknown" is not "recent".
 */
export function isInReleaseWindow(seed: GameSeedLike, candidate: IgdbCandidateLike): boolean {
  if (!seed.releasedFrom) return true
  const from = Date.parse(`${seed.releasedFrom}T00:00:00.000Z`)
  if (Number.isNaN(from)) return false
  if (typeof candidate.first_release_date !== "number") return false
  return candidate.first_release_date * 1000 >= from
}

export function normalizeGameName(raw: string): string {
  return raw
    // Before NFKD: compatibility decomposition would turn ™ into "tm".
    .replace(/[®™]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// Prefixes a candidate may carry without changing which game it is.
const DROPPABLE_PREFIXES = ["the ", "tom clancy's "]

function candidateVariants(name: string): string[] {
  const out = [name]
  for (const prefix of DROPPABLE_PREFIXES) {
    if (name.startsWith(prefix)) out.push(name.slice(prefix.length))
  }
  return out
}

// What may follow an alias for the name to still be "that game": a subtitle,
// an edition, a number. A plain letter may not ("sonic" must not match
// "sonics"), and neither may nothing-but-more-words with no separator.
const SEPARATOR_AFTER_ALIAS = /^[\s:\-–—(,.'!]/

export type MatchTier = 0 | 1

/** 0 = the alias itself, 1 = alias + separator, null = not this game. */
export function matchTier(seed: GameSeedLike, candidateName: string | undefined): MatchTier | null {
  const cand = normalizeGameName(candidateName ?? "")
  if (!cand) return null
  const needles = [...(seed.catalogueTitles ?? []), ...seed.aliases]
    .map(normalizeGameName)
    .filter(Boolean)

  let best: MatchTier | null = null
  for (const variant of candidateVariants(cand)) {
    for (const needle of needles) {
      if (variant === needle) return 0
      if (variant.startsWith(needle) && SEPARATOR_AFTER_ALIAS.test(variant.slice(needle.length))) {
        best = 1
      }
    }
  }
  return best
}

/**
 * The candidate to import for this seed, or null when none of them is the
 * game the seed names.
 */
export function pickIgdbCandidate<T extends IgdbCandidateLike>(
  seed: GameSeedLike,
  candidates: readonly T[],
): T | null {
  const ranked = candidates
    .filter((candidate) => isInReleaseWindow(seed, candidate))
    .map((candidate) => ({ candidate, tier: matchTier(seed, candidate.name) }))
    .filter((x): x is { candidate: T; tier: MatchTier } => x.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (b.candidate.total_rating_count ?? 0) - (a.candidate.total_rating_count ?? 0),
    )
  return ranked[0]?.candidate ?? null
}

/**
 * The candidate that IS this exact catalogue title (tier 0 only — a title +
 * subtitle could be a DLC of the edition we want), inside the seed's release
 * window, most-rated first. Null when IGDB has no entry by that exact name.
 */
export function pickExactTitleCandidate<T extends IgdbCandidateLike>(
  seed: GameSeedLike,
  title: string,
  candidates: readonly T[],
): T | null {
  return pickIgdbCandidate({ name: seed.name, aliases: [title], releasedFrom: seed.releasedFrom }, candidates.filter(
    (candidate) => matchTier({ name: seed.name, aliases: [title] }, candidate.name) === 0,
  ))
}

export type SeedLookup =
  | { kind: "catalogueTitle"; query: string; title: string }
  | { kind: "alias"; query: string }

/**
 * The searches the games-top-names cron runs for a seed, in order.
 *
 * Editions first: the pillar shows the first `catalogueTitles` entry the
 * catalogue holds (src/lib/curated-game-matching.ts), so the cron must try
 * to import THAT one before anything else. Until 21 Nov 2026 it searched the
 * aliases only and stopped at the most-rated hit — « mario kart » found
 * Mario Kart 8 Deluxe, already present, so Mario Kart World was never
 * imported and the pillar kept showing older editions (Just Dance 2014).
 *
 * The caller stops at the first catalogue title IGDB knows (imported or
 * already present): an older edition is never imported once a newer
 * preferred one exists. Aliases come last, with the usual strict pick, for
 * seeds whose catalogue titles IGDB does not list by those exact names.
 */
export function seedLookups(seed: GameSeedLike): SeedLookup[] {
  const titles = (seed.catalogueTitles ?? []).filter((t) => normalizeGameName(t))
  return [
    ...titles.map((title): SeedLookup => ({ kind: "catalogueTitle", query: title, title })),
    ...seed.aliases.map((alias): SeedLookup => ({ kind: "alias", query: alias })),
  ]
}

/** Pick for one lookup: exact title for an edition, strict alias rules otherwise. */
export function pickForLookup<T extends IgdbCandidateLike>(
  seed: GameSeedLike,
  lookup: SeedLookup,
  candidates: readonly T[],
): T | null {
  return lookup.kind === "catalogueTitle"
    ? pickExactTitleCandidate(seed, lookup.title, candidates)
    : pickIgdbCandidate(seed, candidates)
}
