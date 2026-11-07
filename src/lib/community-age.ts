import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// Don't publish (or display) a community age until enough parents have voted.
// A single review used to set communityAgeRec outright — noisy and trivially
// gameable. Below this count the field stays null and the UI shows nothing.
export const MIN_COMMUNITY_AGE_VOTES = 3

type CommunityAgeDb = Pick<Prisma.TransactionClient, "review" | "mediaItem">

/**
 * Recompute a title's community age from its reviews, applying the vote
 * threshold. Shared by the review route (new, updated or removed review) and
 * by account deletion, which removes reviews in bulk inside a transaction —
 * pass that transaction as `db`.
 */
export async function recomputeCommunityAge(mediaId: string, db: CommunityAgeDb = prisma) {
  const reviews = await db.review.findMany({
    where: { mediaId, ageSuggestion: { not: null } },
    select: { ageSuggestion: true },
  })
  if (reviews.length >= MIN_COMMUNITY_AGE_VOTES) {
    const avgAge = reviews.reduce((sum, r) => sum + (r.ageSuggestion || 0), 0) / reviews.length
    await db.mediaItem.update({ where: { id: mediaId }, data: { communityAgeRec: avgAge } })
  } else {
    await db.mediaItem.update({ where: { id: mediaId }, data: { communityAgeRec: null } })
  }
}
