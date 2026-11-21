// Pure selection rules for the seasonal /noel pages (films de Noël par âge,
// jeux vidéo à offrir). No Prisma import: the server fetchers in
// ./queries.ts read the catalogue, these functions decide what is shown —
// so every rule here is pinned by src/lib/__tests__/noel-selection.test.ts.
//
// Two rules matter more than the rest:
//   1. Ages are never written here. A title lands in a band from its live
//      `expertAgeRec` (and, for games, its PEGI) — a band is a filter, not a
//      claim.
//   2. A title is never placed in a band younger than its own age. For games
//      the effective age is the STRICTER of our age and the PEGI, so a gift
//      list for 6-8 ans can never carry a PEGI 12 game.

export interface AgeBand {
  key: string
  /** Heading form: « 3 à 5 ans ». */
  label: string
  /** Inclusive bounds on the title's effective age. */
  min: number
  max: number
}

/**
 * The four bands Xavier asked for. 0 (« Tous publics ») belongs to the
 * youngest band. The oldest band stops at 14: past that, posters start to
 * trip the blur rule and the title is no longer a family pick for the fêtes.
 */
export const NOEL_AGE_BANDS: readonly AgeBand[] = [
  { key: "3-5", label: "3 à 5 ans", min: 0, max: 5 },
  { key: "6-8", label: "6 à 8 ans", min: 6, max: 8 },
  { key: "9-11", label: "9 à 11 ans", min: 9, max: 11 },
  { key: "12-14", label: "12 ans et plus", min: 12, max: 14 },
] as const

/** The band a title belongs to, or null when its age is unknown or past the oldest band. */
export function bandForAge(
  age: number | null | undefined,
  bands: readonly AgeBand[] = NOEL_AGE_BANDS,
): AgeBand | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) return null
  return bands.find((b) => age >= b.min && age <= b.max) ?? null
}

/** PEGI number from a stored rating code ("PEGI_12" → 12), else null. */
export function pegiAge(officialRating: string | null | undefined): number | null {
  const m = officialRating?.match(/^PEGI_(\d+)$/)
  return m ? Number(m[1]) : null
}

/**
 * The age a game is recommended from: the stricter of our age and the PEGI.
 * Our age is usually ≥ PEGI already; taking the max makes the rare opposite
 * case (data drift) fail safe instead of placing a PEGI 12 game in 9-11.
 */
export function effectiveGameAge(
  expertAgeRec: number | null | undefined,
  officialRating: string | null | undefined,
): number | null {
  if (typeof expertAgeRec !== "number") return null
  const pegi = pegiAge(officialRating)
  return pegi == null ? expertAgeRec : Math.max(expertAgeRec, pegi)
}

/**
 * Bayesian (IMDb-style) score: a 9/10 with 12 votes must not outrank an 8/10
 * with 4 000. Same formula as the year collections (src/lib/collections.ts).
 */
export function weightedRating(
  rating: number | null | undefined,
  votes: number | null | undefined,
  priorVotes: number,
  priorRating: number,
): number {
  const r = rating ?? 0
  const v = Math.max(0, votes ?? 0)
  return (v / (v + priorVotes)) * r + (priorVotes / (v + priorVotes)) * priorRating
}

function normTitle(t: string): string {
  return t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Drop add-ons sold on top of a game that is itself in the pool
 * (« Animal Crossing: New Horizons - Happy Home Paradise », « Elden Ring:
 * Shadow of the Erdtree »): you cannot unwrap a DLC without its game. The
 * check is deliberately scoped to the candidate pool — « The Legend of
 * Zelda: Echoes of Wisdom » stays, because the 1986 « The Legend of Zelda »
 * is not a current-console candidate.
 */
export function dropAddOns<T extends { title: string }>(pool: readonly T[]): T[] {
  const bases = pool.map((g) => normTitle(g.title)).filter((t) => t.length >= 4)
  return pool.filter((g) => {
    const t = normTitle(g.title)
    return !bases.some((b) => b !== t && (t.startsWith(`${b}:`) || t.startsWith(`${b} -`)))
  })
}

/**
 * Same display title twice (« Scrooge » 1951, 1970, 2026): the reader needs
 * the year to know which film the card means.
 */
export function homonymTitles(items: readonly { title: string }[]): Set<string> {
  const seen = new Map<string, number>()
  for (const i of items) seen.set(normTitle(i.title), (seen.get(normTitle(i.title)) ?? 0) + 1)
  return new Set([...seen].filter(([, n]) => n > 1).map(([t]) => t))
}

export function needsYear(title: string, homonyms: Set<string>): boolean {
  return homonyms.has(normTitle(title))
}

export interface BandGroup<T> {
  band: AgeBand
  items: T[]
}

/**
 * Group already-ranked items by band, keeping at most `perBand` in each and
 * the input order inside a band. Items without a band are dropped. Empty
 * bands are kept, so the page can say so instead of silently skipping one.
 */
export function groupByBand<T>(
  ranked: readonly T[],
  ageOf: (item: T) => number | null | undefined,
  perBand: number,
  bands: readonly AgeBand[] = NOEL_AGE_BANDS,
): BandGroup<T>[] {
  const groups = bands.map((band) => ({ band, items: [] as T[] }))
  for (const item of ranked) {
    const band = bandForAge(ageOf(item), bands)
    if (!band) continue
    const g = groups.find((x) => x.band.key === band.key)!
    if (g.items.length < perBand) g.items.push(item)
  }
  return groups
}

/**
 * Gift order inside a band: up to `recentSlots` of the best recent releases
 * first (what a child is asking for this year), then the best of the rest.
 * Both halves are ordered by score. Pure so the mix is testable.
 */
export function giftOrder<T extends { releaseDate: Date | null; score: number }>(
  items: readonly T[],
  now: Date,
  recentMonths: number,
  recentSlots: number,
): T[] {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - recentMonths)
  const byScore = [...items].sort((a, b) => b.score - a.score)
  const recent = byScore.filter((i) => i.releaseDate && i.releaseDate >= cutoff).slice(0, recentSlots)
  const chosen = new Set(recent)
  return [...recent, ...byScore.filter((i) => !chosen.has(i))]
}

/** Consoles a gift can be bought for, in display order. */
const GIFT_PLATFORM_ORDER = ["Switch 2", "Switch", "PS5", "Xbox Series", "PC"] as const
const CONSOLE_PLATFORMS = new Set<string>(["Switch 2", "Switch", "PS5", "Xbox Series"])

/** The platforms worth printing on a gift card (current machines only). */
export function giftPlatforms(platforms: readonly string[] | null | undefined): string[] {
  const set = new Set(platforms ?? [])
  return GIFT_PLATFORM_ORDER.filter((p) => set.has(p))
}

/** True when the game can be bought for a current console. */
export function onCurrentConsole(platforms: readonly string[] | null | undefined): boolean {
  return (platforms ?? []).some((p) => CONSOLE_PLATFORMS.has(p))
}

/**
 * Family picks among the films now in theatres: only titles with a fiche and
 * a verified age (a provisional age is a genre guess — never a family pick,
 * same rule as the homepage TopPicksRail), a poster, and an age within reach
 * of the family (`maxAge`). Keeps the cinema order (newest releases first).
 */
export function familyCinemaPicks<
  T extends { inDatabase: boolean; isProvisional: boolean; posterUrl: string | null; expertAgeRec: number | null },
>(movies: readonly T[], maxAge: number, limit: number): T[] {
  return movies
    .filter(
      (m) =>
        m.inDatabase &&
        !m.isProvisional &&
        Boolean(m.posterUrl) &&
        typeof m.expertAgeRec === "number" &&
        m.expertAgeRec <= maxAge,
    )
    .slice(0, limit)
}
