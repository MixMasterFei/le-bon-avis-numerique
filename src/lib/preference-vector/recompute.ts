// Recomputes a single member's preference vector from their current
// reactions and persists it to FamilyMember.memberVector + bumps
// lastVectorUpdateAt. Called synchronously from /api/user/reaction after
// every mutation (POST upsert / DELETE).
//
// Perf budget: <50ms. The query is `reaction by familyMemberId` with a
// small include for contentMetrics — fast even for chatty members.

import { prisma } from "@/lib/prisma"
import { computeMemberVector, type ReactionForAggregation } from "./index"

export async function recomputeMemberVector(familyMemberId: string): Promise<void> {
  const reactions = await prisma.mediaReaction.findMany({
    where: { familyMemberId },
    select: {
      reaction: true,
      source: true,
      media: {
        select: {
          genres: true,
          topics: true,
          contentMetrics: {
            select: {
              violence: true,
              sexNudity: true,
              language: true,
              substanceUse: true,
              toneTags: true,
            },
          },
        },
      },
    },
  })

  const vector = computeMemberVector(
    reactions.map(
      (r): ReactionForAggregation => ({
        reaction: r.reaction,
        source: r.source,
        media: {
          genres: r.media.genres,
          topics: r.media.topics,
          contentMetrics: r.media.contentMetrics,
        },
      }),
    ),
  )

  await prisma.familyMember.update({
    where: { id: familyMemberId },
    data: {
      memberVector: vector as unknown as object, // Prisma JSON column
      lastVectorUpdateAt: new Date(),
    },
  })
}

// Best-effort variant: swallows errors so a vector-recompute failure can't
// take down the reaction-write path. We log the error so the supervisor /
// debt-digest can pick it up if it happens repeatedly.
export async function recomputeMemberVectorSafe(familyMemberId: string): Promise<void> {
  try {
    await recomputeMemberVector(familyMemberId)
  } catch (error) {
    console.error("[preference-vector] recompute failed for", familyMemberId, error)
  }
}
