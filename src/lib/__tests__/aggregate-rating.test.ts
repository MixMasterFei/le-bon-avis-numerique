import { describe, expect, it } from "vitest"
import { buildAggregateRating, MIN_REVIEWS_FOR_AGGREGATE_RATING } from "../aggregate-rating"

describe("buildAggregateRating", () => {
  it("never turns a TMDB score into an AggregateRating", () => {
    // Regression: a fiche with no family reviews published TMDB's audience
    // score (here 8.4 over 32 000 votes) as its schema.org AggregateRating —
    // a rating aggregated from another site, which Google's review-snippet
    // guidelines forbid. The fiche data still carries those fields; they must
    // have no way in.
    const fiche = {
      reviewCount: 0,
      averageRating: null,
      hideContentAnalysis: false,
      tmdbRating: 8.4,
      tmdbVoteCount: 32_000,
    }
    expect(buildAggregateRating(fiche)).toBeUndefined()
  })

  it("stays silent below the minimum number of family reviews", () => {
    expect(MIN_REVIEWS_FOR_AGGREGATE_RATING).toBe(5)
    for (let reviewCount = 0; reviewCount < MIN_REVIEWS_FOR_AGGREGATE_RATING; reviewCount++) {
      expect(
        buildAggregateRating({ reviewCount, averageRating: 4.5, hideContentAnalysis: false }),
      ).toBeUndefined()
    }
  })

  it("emits our own 1-5 star average once the minimum is reached", () => {
    expect(
      buildAggregateRating({ reviewCount: 5, averageRating: 4.2, hideContentAnalysis: false }),
    ).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.2,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 5,
    })
  })

  it("rounds the average to one decimal and reports the full review count", () => {
    // 30 reviews averaging 30/7: the count is every review on the fiche, not
    // the 10 most recent ones the page loads for display.
    expect(
      buildAggregateRating({ reviewCount: 30, averageRating: 30 / 7, hideContentAnalysis: false }),
    ).toMatchObject({ ratingValue: 4.3, ratingCount: 30 })
  })

  it("stays silent on pre-release and provisional fiches", () => {
    expect(
      buildAggregateRating({ reviewCount: 12, averageRating: 4, hideContentAnalysis: true }),
    ).toBeUndefined()
  })

  it("rejects averages that cannot come from 1-5 star ratings", () => {
    for (const averageRating of [null, Number.NaN, 0, 0.9, 5.1, Infinity]) {
      expect(
        buildAggregateRating({ reviewCount: 8, averageRating, hideContentAnalysis: false }),
      ).toBeUndefined()
    }
    expect(
      buildAggregateRating({ reviewCount: 5.5, averageRating: 4, hideContentAnalysis: false }),
    ).toBeUndefined()
  })
})
