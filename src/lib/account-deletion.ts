import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { recomputeCommunityAge } from "@/lib/community-age"

/**
 * Account deletion — what « Supprimer mon compte » promises
 * (src/components/profile/AccountSettings.tsx): the profile, the family
 * members and their reactions, favourites and watch list, and every review and
 * comment. One transaction: either all of it goes, or none of it does.
 *
 * Most personal tables hang off `users` with ON DELETE CASCADE and leave with
 * the account row. This module handles the ones that did not:
 *  - reviews: the FK was SET NULL, so the free-text comment stayed online,
 *    signed « Anonyme »;
 *  - nl_search_queries: SET NULL too, so the raw « Recherche magique » query —
 *    which can name a child — and its interpretation stayed;
 *  - reco_clicks: user_id had no FK at all, so nothing ever removed them;
 *  - verification_tokens: keyed by e-mail, no FK, so a pending reset link
 *    outlived the account.
 * sql/account_deletion_cascades.sql makes the database agree, so a user row
 * removed any other way can no longer leave that text behind either.
 *
 * Retention rule — the only thing kept. A billable « Recherche magique »
 * interpretation (status "llm") stays as an anonymous cost counter: no user
 * id, no query text, no hash, no interpretation. The global daily cost cap
 * (NL_SEARCH_GLOBAL_DAILY_CAP, src/lib/nl-search/daily-cap.ts) counts these
 * rows, so deleting them would let an account deletion hand back part of that
 * day's budget; the cost history is the aggregate telemetry the table was
 * designed to keep. The rows still age out with the table's 90-day retention
 * (src/lib/nl-search/telemetry.ts). Every other search row is deleted.
 */

/**
 * Written over an anonymised cost row's query hash. A real cache key is a
 * 64-character sha256 hex digest, so this can never answer a parse-cache
 * lookup, and nothing about the original query survives in it.
 */
export const ERASED_QUERY_HASH = "erased"

/**
 * Every field in prisma/schema.prisma that points at an account (directly, or
 * through one of its family members), and what deletion does with it. A test
 * (src/lib/__tests__/account-deletion.test.ts) re-derives the list from the
 * schema and fails when a new reference appears without a decision here, or
 * when a "cascade" relation stops cascading.
 *
 *  - "cascade": ON DELETE CASCADE from users (or from family_members, or from
 *    a parent row that cascades) — removed with the account row.
 *  - "deleted": removed explicitly by deleteUserAccount before the account row.
 *  - "audit-id": a staff member's id on SOMEONE ELSE's submission (who
 *    reviewed a correction / resolved a request). Left as is: the other
 *    member's row is not touched, and once the account row is gone the bare
 *    id resolves to nobody — no name, no e-mail, no content.
 *  - "unused": declared but never written by any code path.
 */
export const USER_REFERENCES = {
  "Account.userId": "cascade",
  "Session.userId": "cascade",
  "Favorite.userId": "cascade",
  "Watchlist.userId": "cascade",
  "ReviewReport.userId": "cascade",
  "FamilyMember.userId": "cascade",
  "MediaReaction.familyMemberId": "cascade",
  "MediaCorrection.userId": "cascade",
  "ContentRequest.userId": "cascade",
  "UserContentMetrics.userId": "cascade",
  "FamilySettings.userId": "cascade",
  "AdminActivity.userId": "cascade",
  "AgeVote.userId": "cascade",
  "FamilyWarningVote.userId": "cascade",
  "TriggerVote.userId": "cascade",
  "NewsComment.userId": "cascade",
  "NewsCommentReaction.userId": "cascade",
  "NewsCommentReport.userId": "cascade",
  "NewsStoryReaction.userId": "cascade",
  "NewsSavedStory.userId": "cascade",
  "Notification.userId": "cascade",
  "ReleaseAlert.userId": "cascade",
  "TotemConversation.userId": "cascade",
  "DecouverteBoard.userId": "cascade",
  "Review.userId": "deleted",
  "Review.familyMemberId": "deleted",
  "NlSearchQuery.userId": "deleted",
  "RecoClick.userId": "deleted",
  "MediaCorrection.reviewedBy": "audit-id",
  "ContentRequest.resolvedBy": "audit-id",
  "MediaItem.enrichedBy": "unused",
} as const satisfies Record<string, "cascade" | "deleted" | "audit-id" | "unused">

export interface AccountDeletionSummary {
  reviews: number
  communityAgesRecomputed: number
  recoClicks: number
  searchesDeleted: number
  searchCostRowsAnonymised: number
  verificationTokens: number
}

/**
 * Deletes the account and everything it owns, in one transaction. Returns
 * null when no such account exists (nothing is written). Any failure throws
 * and rolls the whole transaction back: nothing is ever half-deleted.
 *
 * Every statement filters on this account (its id, its family members, its
 * e-mail): no other member's row is written, except the community age of a
 * title, recomputed from the reviews that remain.
 */
export async function deleteUserAccount(userId: string): Promise<AccountDeletionSummary | null> {
  return prisma.$transaction(
    async (tx) => {
      // Lock the account row first. Inserting into any table with a foreign
      // key to users takes a KEY SHARE lock on the referenced row, which this
      // FOR UPDATE blocks: a review, search or conversation written meanwhile
      // (from another tab) waits, then fails against the deleted row — it can
      // never land between the clean-up below and the final delete.
      const [account] = await tx.$queryRaw<{ id: string; email: string }[]>`
        SELECT "id", "email" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
      if (!account) return null

      // 1. Reviews, comment included — written by the account or in the name
      //    of one of its children — then the community ages they fed.
      const ownReviews: Prisma.ReviewWhereInput = {
        OR: [{ userId }, { familyMember: { userId } }],
      }
      const reviewed = await tx.review.findMany({
        where: ownReviews,
        select: { mediaId: true, ageSuggestion: true },
      })
      const reviews = await tx.review.deleteMany({ where: ownReviews })
      const agedMedia = [
        ...new Set(reviewed.filter((r) => r.ageSuggestion !== null).map((r) => r.mediaId)),
      ]
      for (const mediaId of agedMedia) {
        await recomputeCommunityAge(mediaId, tx)
      }

      // 2. Recommendation clicks (no foreign key: nothing else removes them).
      const recoClicks = await tx.recoClick.deleteMany({ where: { userId } })

      // 3. « Recherche magique »: billable rows become anonymous cost counters
      //    (see the retention rule above), every other row is deleted.
      const anonymised = await tx.nlSearchQuery.updateMany({
        where: { userId, status: "llm" },
        data: { userId: null, query: "", queryHash: ERASED_QUERY_HASH, intent: Prisma.DbNull },
      })
      const searches = await tx.nlSearchQuery.deleteMany({ where: { userId } })

      // 4. Pending e-mail verification and password-reset links.
      const tokens = await tx.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { equals: account.email, mode: "insensitive" } },
            { identifier: { equals: `reset:${account.email}`, mode: "insensitive" } },
          ],
        },
      })

      // 5. The account row. ON DELETE CASCADE takes everything else with it:
      //    sign-in accounts and sessions, family members (and their reactions
      //    and notes), family settings, favourites, watch list, votes, content
      //    ratings, corrections, content requests, reports, news comments,
      //    reactions and saved stories, notifications, release alerts, Totem
      //    conversations (messages and feedback), saved and shared boards (and
      //    the ballot votes on them), admin activity.
      await tx.user.delete({ where: { id: userId } })

      return {
        reviews: reviews.count,
        communityAgesRecomputed: agedMedia.length,
        recoClicks: recoClicks.count,
        searchesDeleted: searches.count,
        searchCostRowsAnonymised: anonymised.count,
        verificationTokens: tokens.count,
      }
    },
    // A large account means a few thousand cascaded rows: give the pooled
    // connection room, well inside the route's maxDuration.
    { maxWait: 10_000, timeout: 30_000 },
  )
}
