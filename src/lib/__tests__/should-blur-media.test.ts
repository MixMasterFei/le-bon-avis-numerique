import { describe, expect, it } from "vitest"
import { shouldBlurMedia } from "../should-blur-media"

const ON = true

describe("shouldBlurMedia", () => {
  it("blurs a horror title that has no content metrics yet", () => {
    // Regression: "Insidious : L'Invasion du Lointain" — in theatres, imported
    // with a provisional 13+, isEnriched=false so every metric reads 0. The
    // metrics-only rule left the jump-scare poster crisp on the family
    // homepage.
    expect(
      shouldBlurMedia(
        { type: "MOVIE", expertAgeRec: 13, genres: ["Horreur", "Thriller"] },
        ON,
      ),
    ).toBe(true)
  })

  it("matches the accented Épouvante spelling", () => {
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 12, genres: ["Épouvante"] }, ON)).toBe(true)
  })

  it("does not blur a thriller or a polar", () => {
    // Deliberately narrower than family-fit's MATURE_GENRES: blurring every
    // polar would train parents to click through the blur.
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 13, genres: ["Thriller"] }, ON)).toBe(false)
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 14, genres: ["Crime", "Drame"] }, ON)).toBe(false)
  })

  it("does not blur a young-rated title even if tagged horror", () => {
    // A haunted-mansion aesthetic can earn the tag on a 6+ title.
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 6, genres: ["Horreur"] }, ON)).toBe(false)
  })

  it("keeps the metrics trigger for 15+ content", () => {
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 16, violence: 4 }, ON)).toBe(true)
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 16, violence: 1 }, ON)).toBe(false)
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 12, violence: 5 }, ON)).toBe(false)
  })

  it("never blurs games or when the toggle is off", () => {
    expect(shouldBlurMedia({ type: "GAME", expertAgeRec: 18, genres: ["Horreur"], violence: 5 }, ON)).toBe(false)
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: 18, genres: ["Horreur"], violence: 5 }, false)).toBe(false)
  })

  it("does nothing without an age", () => {
    expect(shouldBlurMedia({ type: "MOVIE", expertAgeRec: null, genres: ["Horreur"] }, ON)).toBe(false)
  })
})
