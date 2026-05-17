import { describe, expect, it } from "vitest"
import { tmdbPosterAtSize, tmdbPosterSizeForWidth } from "../tmdb-image"

describe("tmdbPosterAtSize", () => {
  it("rewrites the size segment in a stored w500 URL", () => {
    const original = "https://image.tmdb.org/t/p/w500/3xGLxvuVvLoPhrCxkofkczfR6R5.jpg"
    expect(tmdbPosterAtSize(original, "w342"))
      .toBe("https://image.tmdb.org/t/p/w342/3xGLxvuVvLoPhrCxkofkczfR6R5.jpg")
  })

  it("works for any size tier", () => {
    const url = "https://image.tmdb.org/t/p/w500/foo.jpg"
    expect(tmdbPosterAtSize(url, "w185")).toContain("/t/p/w185/")
    expect(tmdbPosterAtSize(url, "w780")).toContain("/t/p/w780/")
  })

  it("passes through non-TMDB URLs unchanged (IGDB, placeholders, etc.)", () => {
    expect(tmdbPosterAtSize("https://images.igdb.com/abc.jpg", "w185"))
      .toBe("https://images.igdb.com/abc.jpg")
    expect(tmdbPosterAtSize("/placeholder-poster.jpg", "w185"))
      .toBe("/placeholder-poster.jpg")
  })

  it("handles null/undefined/empty", () => {
    expect(tmdbPosterAtSize(null, "w185")).toBe("")
    expect(tmdbPosterAtSize(undefined, "w185")).toBe("")
    expect(tmdbPosterAtSize("", "w185")).toBe("")
  })

  it("does not alter the size when it's already correct", () => {
    const already = "https://image.tmdb.org/t/p/w342/foo.jpg"
    expect(tmdbPosterAtSize(already, "w342")).toBe(already)
  })
})

describe("tmdbPosterSizeForWidth", () => {
  it("picks adequate tiers for common card widths", () => {
    expect(tmdbPosterSizeForWidth(80)).toBe("w185")   // sidebar thumb
    expect(tmdbPosterSizeForWidth(140)).toBe("w342")  // rail card
    expect(tmdbPosterSizeForWidth(205)).toBe("w500")  // homepage MediaCard
    expect(tmdbPosterSizeForWidth(300)).toBe("w780")  // hero
  })

  it("snaps up to the next tier on boundary", () => {
    expect(tmdbPosterSizeForWidth(92)).toBe("w185")
    expect(tmdbPosterSizeForWidth(93)).toBe("w342")
    expect(tmdbPosterSizeForWidth(171)).toBe("w342")
    expect(tmdbPosterSizeForWidth(172)).toBe("w500")
  })
})
