/**
 * Seasonal (holiday-themed) content gating.
 *
 * A "Noël" film on a Netflix rail in August is the single loudest "this site is
 * stale" signal — it reads as an unmaintained catalogue even though the data is
 * fine. This check used to live inline in the homepage top-picks rail only, so
 * every OTHER rail (plateformes, coups de cœur…) still shipped Christmas titles
 * year-round.
 *
 * Matching looks at title + genres + TOPICS. Topics are the reliable signal:
 * enrichment tags these titles "Noël" / "Halloween" even when the title itself
 * doesn't say so ("Elmo et Mark Rober fêtent Sesamoël", "Merry Giftmas").
 * Accents are folded so "Noël" and "noel" both match, and every token is
 * word-bounded — an unbounded "advent" would have swallowed every "Adventure".
 */

export interface SeasonalCandidate {
  title?: string | null
  genres?: string[] | null
  topics?: string[] | null
}

const CHRISTMAS =
  /\b(noel|noels|christmas|xmas|giftmas|santa|jingle|nutcracker|reveillon|scrooge|grinch)\b/
const HALLOWEEN = /\b(halloween)\b/

/** Months (0-indexed) where each season is in-season. */
const CHRISTMAS_MONTHS = new Set([10, 11]) // novembre – décembre
const HALLOWEEN_MONTHS = new Set([9]) //      octobre

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function haystack(m: SeasonalCandidate): string {
  return fold([m.title ?? "", ...(m.genres ?? []), ...(m.topics ?? [])].join(" "))
}

/**
 * True when the title is holiday-themed and we are NOT in its season.
 * `month0` is a 0-indexed month (as returned by `Date#getMonth`).
 */
export function isOutOfSeason(
  m: SeasonalCandidate,
  month0: number = new Date().getMonth(),
): boolean {
  const hay = haystack(m)
  if (!CHRISTMAS_MONTHS.has(month0) && CHRISTMAS.test(hay)) return true
  if (!HALLOWEEN_MONTHS.has(month0) && HALLOWEEN.test(hay)) return true
  return false
}

/** Convenience predicate for `Array#filter`. */
export function inSeason(month0: number = new Date().getMonth()) {
  return (m: SeasonalCandidate) => !isOutOfSeason(m, month0)
}
