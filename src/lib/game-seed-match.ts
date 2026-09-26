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
 *   - within a tier the most-rated entry wins (the mainline game, not a DLC).
 */

export interface GameSeedLike {
  name: string
  /** Lowercased title fragments, see topGames.data.ts. */
  aliases: readonly string[]
  /** Exact full titles, in editorial preference order. */
  catalogueTitles?: readonly string[]
}

export interface IgdbCandidateLike {
  id: number
  name?: string
  total_rating_count?: number
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
    .map((candidate) => ({ candidate, tier: matchTier(seed, candidate.name) }))
    .filter((x): x is { candidate: T; tier: MatchTier } => x.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (b.candidate.total_rating_count ?? 0) - (a.candidate.total_rating_count ?? 0),
    )
  return ranked[0]?.candidate ?? null
}
