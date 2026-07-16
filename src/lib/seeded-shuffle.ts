/**
 * Week-seeded shuffle utility for rotating homepage content.
 * Same week = same order for all visitors. New week = new selection.
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic Fisher-Yates shuffle using a seeded PRNG. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  const rng = mulberry32(seed)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Deterministic WEIGHTED sample-ordering (Efraimidis–Spirakis): each item gets
 * key = u^(1/weight) with u seeded-uniform, then sorts by key descending. The
 * probability that an item lands first is proportional to its weight, so higher
 * weights are favoured — but every item can surface on a given seed.
 *
 * This is the "idées du jour" rotation: unlike a fixed top-N-by-score (which
 * shows the same best-fitting titles every day), a daily seed here produces a
 * genuinely different selection each day while still leaning toward the best
 * matches. `weight` should be a positive number (clamped to ≥ epsilon).
 */
export function weightedSeededOrder<T>(
  arr: T[],
  weight: (item: T) => number,
  seed: number,
): T[] {
  const rng = mulberry32(seed)
  return arr
    .map((item) => {
      const w = Math.max(1e-6, weight(item))
      const u = rng() || 1e-9 // avoid log(0) / 0-key ties
      return { item, key: Math.pow(u, 1 / w) }
    })
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item)
}

/** Returns a seed that changes every Monday (ISO 8601 week number × year). */
export function getWeekSeed(): number {
  const now = new Date()
  // ISO 8601: week starts Monday, week 1 contains the first Thursday of the year.
  // Copy date so we don't mutate, then adjust to nearest Thursday (current date + 4 - dayOfWeek).
  // Thursday in current week decides the year/week.
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = d.getUTCDay() || 7 // Monday=1 ... Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - day) // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return d.getUTCFullYear() * 100 + weekNum
}

/**
 * Returns a seed that changes every day at midnight Paris time.
 * Format: YYYYMMDD as a number (e.g. 20260509). Use for the homepage's
 * "Sélection du jour" rail so the shuffle re-orders every morning.
 */
export function getDaySeed(now: Date = new Date()): number {
  // Use Intl to get the Paris-local Y/M/D so the seed flips at the
  // right moment for French visitors regardless of server timezone.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  // en-CA produces "YYYY-MM-DD" which we strip dashes from.
  const iso = fmt.format(now) // "2026-05-09"
  return Number(iso.replace(/-/g, ""))
}
