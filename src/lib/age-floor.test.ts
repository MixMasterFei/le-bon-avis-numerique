import { describe, it, expect } from "vitest"
import { floorExpertAgeBySignals, isAnimationStyle } from "./age-floor"

describe("floorExpertAgeBySignals", () => {
  it("raises a lenient-rated live-action drama with moderate axes (Forrest Gump case)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 10,
        metrics: { violence: 3, substanceUse: 3 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(12)
  })

  it("floors graphic live-action (axis 4+) to 14", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 11,
        metrics: { violence: 5 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(14)
  })

  it("applies the animation discount (axis 4 animation → 12, not 14)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        metrics: { violence: 4 },
        genres: ["Animation"],
      }),
    ).toBe(12)
  })

  it("does not over-flag a family comedy (max axis 2)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 6,
        metrics: { violence: 1, language: 2 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(6)
  })

  it("floors live-action war themes to 12 even with moderate metrics", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        metrics: { violence: 2 },
        topics: ["Guerre"],
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(12)
  })

  it("never lowers an already-mature age", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 16,
        metrics: { violence: 5, sexNudity: 4 },
      }),
    ).toBe(16)
  })

  it("floors a game rated below its PEGI age (the leniency case)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        type: "GAME",
        officialRating: "PEGI_12",
      }),
    ).toBe(12)
  })

  it("keeps a game already above its PEGI age (independent guidance can be stricter)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 14,
        type: "GAME",
        officialRating: "PEGI_12",
      }),
    ).toBe(14)
  })

  it("does not apply content-axis floors to games (PEGI only)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 7,
        type: "GAME",
        metrics: { violence: 5 },
        officialRating: "PEGI_7",
      }),
    ).toBe(7)
  })

  it("floors a game with no PEGI rating using the axis floor (2026-07-11 fix: PEGI coverage is frequently missing for indie titles, and a missing rating used to mean NO floor applied at all)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 7,
        type: "GAME",
        metrics: { violence: 5 },
        officialRating: null,
      }),
    ).toBe(14)
  })

  it("leaves a genuinely mild game with no PEGI rating unchanged", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 7,
        type: "GAME",
        metrics: { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 },
        officialRating: null,
      }),
    ).toBe(7)
  })

  it("floors an under-rated indie horror game with no PEGI data (the real case: 'No, I'm Not A Human', reported 2026-07-11)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 12,
        type: "GAME",
        officialRating: null,
        metrics: { violence: 2, sexNudity: 0, language: 1, substanceUse: 0 },
        genres: ["Simulation", "Indé"],
        topics: ["Vue FPS", "3D", "Solo", "Horreur", "Atmosphérique"],
      }),
    ).toBe(14)
  })

  it("floors a horror film/TV title even with low content axes (fright intensity has no dedicated axis)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 10,
        type: "MOVIE",
        metrics: { violence: 1, sexNudity: 0, language: 0, substanceUse: 0 },
        topics: ["Horreur", "Mystère"],
      }),
    ).toBe(14)
  })

  it("does not float a kid-friendly Halloween title into the horror floor (broader scary-adjacent tags stay soft-only)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        type: "MOVIE",
        metrics: { violence: 1, sexNudity: 0, language: 0, substanceUse: 0 },
        genres: ["Comédie", "Famille"],
        topics: ["Halloween"],
      }),
    ).toBe(8)
  })

  it("does NOT override an existing PEGI rating with the horror floor (regression guard: Luigi's Mansion 3 is PEGI 7 despite a 'Horreur' tag from its haunted-mansion setting)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        type: "GAME",
        officialRating: "PEGI_7",
        metrics: { violence: 1, sexNudity: 0, language: 0, substanceUse: 0 },
        topics: ["Horreur", "Aventure"],
      }),
    ).toBe(8)
  })

  it("ignores CSA ratings for films (only PEGI is a floor input)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 6,
        type: "MOVIE",
        metrics: { violence: 1 },
        officialRating: "CSA_12",
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(6)
  })

  it("handles missing metrics gracefully", () => {
    expect(floorExpertAgeBySignals({ expertAgeRec: 9, metrics: null })).toBe(9)
  })
})

describe("isAnimationStyle", () => {
  it("detects animation visual styles", () => {
    expect(isAnimationStyle("Animation 3D/CGI")).toBe(true)
    expect(isAnimationStyle("Anime japonais")).toBe(true)
  })
  it("detects animation via genre", () => {
    expect(isAnimationStyle(null, ["Animation", "Aventure"])).toBe(true)
  })
  it("returns false for live action", () => {
    expect(isAnimationStyle("Prise de vue réelle", ["Drame"])).toBe(false)
  })
})
