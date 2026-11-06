/**
 * schema.org `AggregateRating` for a fiche's JSON-LD — first-party ratings only.
 *
 * Google's review-snippet guidelines forbid marking up ratings aggregated from
 * other sites, and the house rule is that TMDB/IGDB audience scores are never
 * shown. So the ONLY input is our own families' star ratings (`Review.rating`,
 * 1-5) — this helper has no way to receive a third-party score — and the block
 * is emitted only once there are enough of them to mean something. Below
 * `MIN_REVIEWS_FOR_AGGREGATE_RATING`, or on a pre-release / provisional fiche,
 * it is omitted entirely: no rating at all beats a borrowed or flimsy one.
 */

export const MIN_REVIEWS_FOR_AGGREGATE_RATING = 5

const WORST_RATING = 1
const BEST_RATING = 5

export interface FirstPartyRatingStats {
  /** Number of Totem Avisé reviews on the fiche — ALL of them, not just the page loaded for display. */
  reviewCount: number
  /** Mean of those reviews' 1-5 star ratings; null when there are none. */
  averageRating: number | null
  /** Pre-release / provisional fiche (`shouldHideContentAnalysis`): no rating either. */
  hideContentAnalysis: boolean
}

export interface AggregateRatingJsonLd {
  "@type": "AggregateRating"
  ratingValue: number
  bestRating: number
  worstRating: number
  ratingCount: number
}

export function buildAggregateRating({
  reviewCount,
  averageRating,
  hideContentAnalysis,
}: FirstPartyRatingStats): AggregateRatingJsonLd | undefined {
  if (hideContentAnalysis) return undefined
  if (!Number.isInteger(reviewCount) || reviewCount < MIN_REVIEWS_FOR_AGGREGATE_RATING) {
    return undefined
  }
  if (
    averageRating == null ||
    !Number.isFinite(averageRating) ||
    averageRating < WORST_RATING ||
    averageRating > BEST_RATING
  ) {
    return undefined
  }

  return {
    "@type": "AggregateRating",
    ratingValue: Math.round(averageRating * 10) / 10,
    bestRating: BEST_RATING,
    worstRating: WORST_RATING,
    ratingCount: reviewCount,
  }
}
