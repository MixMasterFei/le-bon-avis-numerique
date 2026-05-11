/**
 * Feed-level editorial balancer for the V3 news landing.
 *
 * Per-story moderation can't tell you that two grave stories are
 * about to sit next to each other at the top of the page — that
 * needs a pass over the whole batch. This function takes the
 * recency-sorted candidate list and reorders + thins so the user's
 * first impression isn't "wall of trauma" while still keeping the
 * important items visible.
 *
 * Invisible to the reader by design — no "Bonne nouvelle" pill,
 * no per-card framing change. Balancing just shifts what surfaces
 * in the top tier.
 *
 * Rules, applied in order to the top N slice (default 6):
 *   1. Hero (slot 0) is never `grave`. If the most recent story is
 *      grave, the hero is swapped with the next non-grave candidate.
 *   2. No two consecutive slots share the same `topicCluster`. If
 *      they do, the second occurrence is bumped out of the top tier
 *      and replaced with the next eligible story.
 *   3. At most one `grave` story in the whole top tier.
 *   4. If at least one `positive` story exists in the candidate
 *      pool but none would land in the top tier on recency alone,
 *      one is promoted into the bottom half of the tier so the
 *      tonal mix isn't all heavy.
 *
 * Story shape: only the fields the balancer needs. Caller does the
 * Prisma query with whatever projection it wants and casts the rows
 * (or maps them) to this minimal interface.
 */

export interface BalanceableStory {
  id: string
  publishedAt: Date | string
  // Allow undefined so callers don't have to coerce — Prisma rows
  // typed with an optional select shape would otherwise fail to
  // satisfy this interface.
  editorialTone?: string | null
  topicCluster?: string | null
}

function tone(s: BalanceableStory): "positive" | "neutral" | "concerning" | "grave" {
  const t = (s.editorialTone ?? "").toLowerCase()
  if (t === "positive" || t === "concerning" || t === "grave") return t
  return "neutral"
}

function cluster(s: BalanceableStory): string {
  // null cluster groups items as "_unclustered" — they're treated as
  // independent and rule 2 (no consecutive-cluster) doesn't apply to
  // them since the absence of a shared topic isn't a clash.
  return s.topicCluster?.trim() || "_unclustered"
}

function isUnclustered(s: BalanceableStory): boolean {
  return cluster(s) === "_unclustered"
}

/**
 * Reorder + thin a recency-sorted list of stories for the top `top`
 * slots. Inputs must already be sorted by `publishedAt desc`. Returns
 * a new array (same length as input) with the top `top` slots
 * rebalanced and the tail untouched.
 */
export function balanceNewsForFeed<T extends BalanceableStory>(
  storiesByRecency: T[],
  top = 6,
): T[] {
  if (storiesByRecency.length <= 1) return [...storiesByRecency]

  const pool = [...storiesByRecency]
  const balanced: T[] = []

  // Rule 1: hero is never grave. Find first non-grave for slot 0.
  let heroIdx = pool.findIndex((s) => tone(s) !== "grave")
  if (heroIdx === -1) heroIdx = 0 // everything is grave — degrade gracefully
  balanced.push(pool.splice(heroIdx, 1)[0])

  let graveUsed = tone(balanced[0]) === "grave" ? 1 : 0
  const usedClusters = new Set<string>([cluster(balanced[0])])

  // Slots 1..top-1: walk recency, skipping items that violate rules.
  // Skipped items go to the back of the pool for the tail (rule 2
  // and the grave-cap shift them down, they don't disappear).
  const deferred: T[] = []
  while (balanced.length < top && pool.length > 0) {
    const idx = pool.findIndex((s) => {
      const t = tone(s)
      if (t === "grave" && graveUsed >= 1) return false
      const c = cluster(s)
      if (!isUnclustered({ ...s, topicCluster: c }) && usedClusters.has(c)) return false
      return true
    })
    if (idx === -1) break
    const picked = pool.splice(idx, 1)[0]
    balanced.push(picked)
    if (tone(picked) === "grave") graveUsed++
    if (!isUnclustered(picked)) usedClusters.add(cluster(picked))
  }

  // Rule 4: if no positive story made it in but at least one exists,
  // promote the most recent positive into the tier's second half so
  // the tonal mix has at least one lift.
  const haveAnyPositive = balanced.some((s) => tone(s) === "positive")
  if (!haveAnyPositive) {
    const positiveIdx = pool.findIndex((s) => tone(s) === "positive")
    if (positiveIdx !== -1 && balanced.length >= 3) {
      // Insert at the midpoint of the tier (slot 3 of 6).
      const insertAt = Math.floor(balanced.length / 2)
      // Displace the item at insertAt to the deferred pile rather
      // than dropping it — keeps the feed length stable below.
      deferred.push(balanced[insertAt])
      balanced[insertAt] = pool.splice(positiveIdx, 1)[0]
    }
  }

  return [...balanced, ...deferred, ...pool]
}
