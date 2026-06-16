import { describe, expect, it } from "vitest"
import { vigilanceAxisLevel, vigilanceMax, vigilanceTone } from "./totem"

describe("vigilanceAxisLevel — cartoon-friendly bucketing + age anchor", () => {
  it("buckets raw scores: ≤2→0, 3→1, 4→2, 5→3 (no age)", () => {
    expect(vigilanceAxisLevel(0, null)).toBe(0)
    expect(vigilanceAxisLevel(2, null)).toBe(0)
    expect(vigilanceAxisLevel(3, null)).toBe(1)
    expect(vigilanceAxisLevel(4, null)).toBe(2)
    expect(vigilanceAxisLevel(5, null)).toBe(3)
  })

  it("Sonic-like: raw 3 on an 8+ title → léger (1)", () => {
    expect(vigilanceAxisLevel(3, 8)).toBe(1)
  })

  it("Jungle-Cruise-like: raw 4 on a 10+ title → à noter (2)", () => {
    expect(vigilanceAxisLevel(4, 10)).toBe(2)
  })

  it("age cap: a ≤8 title can't exceed léger even at raw 4/5", () => {
    expect(vigilanceAxisLevel(4, 6)).toBe(1)
    expect(vigilanceAxisLevel(5, 6)).toBe(1)
  })

  it("no cap when age is null (graphic unrated title still flags)", () => {
    expect(vigilanceAxisLevel(4, null)).toBe(2)
    expect(vigilanceAxisLevel(5, undefined)).toBe(3)
  })

  it("calm family content stays at 0", () => {
    expect(vigilanceAxisLevel(2, 6)).toBe(0)
    expect(vigilanceAxisLevel(null, 6)).toBe(0)
  })
})

describe("vigilanceMax — overall = max across axes", () => {
  it("a single high axis flips the overall level (not an average)", () => {
    expect(vigilanceMax({ violence: 4, sexNudity: 0, language: 0, substanceUse: 0 }, "MOVIE", 12)).toBe(2)
  })

  it("respects the age cap across all axes", () => {
    expect(vigilanceMax({ violence: 5, language: 4 }, "MOVIE", 6)).toBe(1)
  })

  it("games consider violence, language, consumerism, and substances", () => {
    expect(vigilanceMax({ violence: 0, language: 5, consumerism: 0, substanceUse: 0 }, "GAME", 12)).toBe(3)
    expect(vigilanceMax({ violence: 0, language: 0, consumerism: 4, substanceUse: 0 }, "GAME", 12)).toBe(2)
  })

  it("returns 0 with no metrics", () => {
    expect(vigilanceMax(null, "MOVIE", 10)).toBe(0)
  })
})

describe("vigilanceTone — coarse severity dot", () => {
  it("red when an axis is high (raw ≥4)", () => {
    expect(vigilanceTone({ violence: 4 }, "MOVIE", 12, ["Action"])).toBe("red")
    expect(vigilanceTone({ language: 5 }, "MOVIE", 14, [])).toBe("red")
  })

  it("red for a mature genre even if the metric is under-scored", () => {
    // Horror stored at only violence 3 → would be amber by metric, but the
    // genre floor makes it red.
    expect(vigilanceTone({ violence: 3 }, "MOVIE", 16, ["Horreur"])).toBe("red")
    expect(vigilanceTone(null, "MOVIE", 16, ["Thriller"])).toBe("red")
  })

  it("amber when there are points but nothing high", () => {
    expect(vigilanceTone({ violence: 3 }, "MOVIE", 10, ["Action"])).toBe("amber")
  })

  it("none when nothing to flag", () => {
    expect(vigilanceTone({ violence: 2 }, "MOVIE", 6, ["Animation"])).toBe("none")
    expect(vigilanceTone(null, "MOVIE", 6, ["Animation"])).toBe("none")
  })

  it("age cap keeps a young title from going red on metric alone", () => {
    // raw 5 on a 6+ title is clamped to level 1 → amber, not red (no mature genre).
    expect(vigilanceTone({ violence: 5 }, "MOVIE", 6, ["Animation"])).toBe("amber")
  })
})
