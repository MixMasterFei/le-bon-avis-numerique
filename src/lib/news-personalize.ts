/**
 * Per-FAMILY news personalization — the selection layer of the feedback loop.
 *
 * The news pipeline runs ONCE for everyone (a shared pool of synthesized
 * stories); personalization happens when each family's feed is assembled:
 *   1. stories the account explicitly disliked are excluded from THEIR feed
 *      (never shown again — "pas pour nous" means pas pour nous);
 *   2. categories the family likes/dislikes get a bounded relevance boost /
 *      demotion, so their feed drifts toward what they engage with.
 *
 * This is deterministic and per-account (family = account: news reactions are
 * user-scoped, unlike media reactions which are per-child). The site-wide
 * aggregate (news-feedback-server.ts) separately steers what gets WRITTEN;
 * this module steers what each family SEES.
 *
 * Pure — no prisma import — so it's unit-testable and client-safe.
 */

export interface NewsReactionLite {
  type: string // "LIKE" | "DISLIKE"
  category: string
}

// Tuning: a dislike weighs more than a like (negative signal is rarer and
// more deliberate), and the resulting boost is bounded so a category can be
// demoted but never censored — news breadth matters more than taste comfort,
// and a family's feed must not collapse into a single-topic bubble.
const LIKE_WEIGHT = 1
const DISLIKE_WEIGHT = -1.5
const POINT_VALUE = 0.06 // relevanceScore units per net point
export const MAX_CATEGORY_BOOST = 0.2
export const MIN_CATEGORY_BOOST = -0.3

/**
 * Net like/dislike counts per category → bounded relevanceScore adjustment.
 * With relevanceScore in 0..1, ±0.2/−0.3 reorders *within* the feed without
 * letting one enthusiastic week erase a whole category.
 */
export function computeCategoryAffinity(rows: NewsReactionLite[]): Record<string, number> {
  const net = new Map<string, number>()
  for (const r of rows) {
    const delta = r.type === "LIKE" ? LIKE_WEIGHT : r.type === "DISLIKE" ? DISLIKE_WEIGHT : 0
    if (delta === 0 || !r.category) continue
    net.set(r.category, (net.get(r.category) ?? 0) + delta)
  }
  const affinity: Record<string, number> = {}
  for (const [category, points] of net) {
    affinity[category] = Math.max(MIN_CATEGORY_BOOST, Math.min(MAX_CATEGORY_BOOST, points * POINT_VALUE))
  }
  return affinity
}

/** relevanceScore adjusted by the family's category affinity. */
export function personalizedRelevance(
  relevanceScore: number,
  category: string,
  affinity: Record<string, number> | null | undefined,
): number {
  return relevanceScore + (affinity?.[category] ?? 0)
}
