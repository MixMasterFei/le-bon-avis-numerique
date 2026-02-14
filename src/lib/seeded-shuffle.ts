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
