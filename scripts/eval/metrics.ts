/** Shared scoring for the Plan B eval harness (baseline + provider A/B). */

export interface Stats {
  n: number
  mae: number
  within1: number // %
  within2: number // %
  stricter: number // % predicted > reference
  equal: number // %
  lenient: number // % predicted < reference
}

export function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10
}

/** Compares a predicted age to a reference age across a set of pairs. */
export function computeStats(rows: { pred: number; ref: number }[]): Stats {
  const n = rows.length
  if (n === 0) return { n: 0, mae: 0, within1: 0, within2: 0, stricter: 0, equal: 0, lenient: 0 }
  let absErr = 0
  let w1 = 0
  let w2 = 0
  let stricter = 0
  let equal = 0
  let lenient = 0
  for (const { pred, ref } of rows) {
    const d = pred - ref
    absErr += Math.abs(d)
    if (Math.abs(d) <= 1) w1++
    if (Math.abs(d) <= 2) w2++
    if (d > 0) stricter++
    else if (d === 0) equal++
    else lenient++
  }
  return {
    n,
    mae: Math.round((absErr / n) * 100) / 100,
    within1: pct(w1, n),
    within2: pct(w2, n),
    stricter: pct(stricter, n),
    equal: pct(equal, n),
    lenient: pct(lenient, n),
  }
}
