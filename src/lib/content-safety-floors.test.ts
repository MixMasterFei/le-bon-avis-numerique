import { describe, it, expect } from "vitest"
import { applyContentSafetyFloors, clampMetricsByAge } from "./content-safety-floors"

// These tests exercise the SHARED helper with the exact input SHAPES each write
// path passes it — the lesson from the 2026-07-11 incident was that the pure
// floor function was correct but a call site fed it the wrong variable
// (fresh LLM `tags` instead of persisted `topics`, or no PEGI descriptors), so
// unit-testing the function alone missed the defect. Each block below mirrors a
// real call site.

const FULL_METRICS = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  consumerism: 0,
  substanceUse: 0,
  positiveMessages: 3,
  roleModels: 3,
}

describe("applyContentSafetyFloors — enrich / enrich-deep call shape", () => {
  it("floors a no-PEGI horror GAME to 14 when the signal is in PERSISTED topics but NOT the fresh tags (the regression)", () => {
    // This is the exact 2026-07-11 bug: the LLM's own controlled vocabulary
    // omits "Horreur", so the fresh tags never carry it — only item.topics does.
    const result = applyContentSafetyFloors({
      expertAgeRec: 12,
      metrics: { ...FULL_METRICS, violence: 1 },
      genres: ["Simulation", "Indé"],
      // Caller MUST union persisted topics with fresh tags. Here the persisted
      // topic carries "Horreur"; the fresh tags do not.
      topics: [...["Horreur", "Aventure"], ...["Enquête/Mystère"]],
      type: "GAME",
      officialRating: null,
      pegiDescriptors: [],
    })
    expect(result.expertAgeRec).toBe(14)
  })

  it("does NOT floor when only the fresh tags are passed and they omit the horror signal (proves the union matters)", () => {
    // If a caller wrongly passed fresh tags alone (the old bug), the horror
    // floor would not fire — this test documents WHY the union is required.
    const result = applyContentSafetyFloors({
      expertAgeRec: 12,
      metrics: { ...FULL_METRICS, violence: 1 },
      genres: ["Simulation"],
      topics: ["Enquête/Mystère"], // fresh tags only, no "Horreur"
      type: "GAME",
      officialRating: null,
    })
    expect(result.expertAgeRec).toBe(12) // NOT raised — the signal was dropped
  })

  it("lets an existing PEGI rating take priority over the heuristic horror tag (Luigi's Mansion guard)", () => {
    const result = applyContentSafetyFloors({
      expertAgeRec: 8,
      metrics: { ...FULL_METRICS },
      topics: ["Horreur", "Aventure"],
      type: "GAME",
      officialRating: "PEGI_7",
    })
    expect(result.expertAgeRec).toBe(8) // PEGI 7 wins; horror tag does not override
  })

  it("applies the PEGI descriptor axis floor (Witcher 'Sexualité' case) AND lets it lift the age", () => {
    // A PEGI_18 game flagged "Sexualité" must floor sexNudity to 4 even if the
    // LLM scored it 1 — and the game floors to its PEGI age (18).
    const result = applyContentSafetyFloors({
      expertAgeRec: 12,
      metrics: { ...FULL_METRICS, sexNudity: 1 },
      topics: [],
      type: "GAME",
      officialRating: "PEGI_18",
      pegiDescriptors: ["Sexualité"],
    })
    expect(result.metrics.sexNudity).toBe(4)
    expect(result.expertAgeRec).toBe(18)
  })
})

describe("applyContentSafetyFloors — generate-review call shape (MOVIE/TV, genres double as topics)", () => {
  it("floors a horror MOVIE to 14 via the genre-as-topic signal, with no persisted topics", () => {
    const result = applyContentSafetyFloors({
      expertAgeRec: 10,
      metrics: { ...FULL_METRICS, violence: 1 },
      genres: ["Horreur"],
      topics: ["Horreur"], // generate-review passes genre names as topics
      type: "MOVIE",
      officialRating: null,
    })
    expect(result.expertAgeRec).toBe(14)
  })

  it("does not over-floor a plain family MOVIE", () => {
    const result = applyContentSafetyFloors({
      expertAgeRec: 6,
      metrics: { ...FULL_METRICS, violence: 1 },
      genres: ["Famille", "Animation"],
      topics: ["Famille", "Animation"],
      type: "MOVIE",
      officialRating: null,
    })
    expect(result.expertAgeRec).toBe(6)
  })
})

describe("applyContentSafetyFloors — young-age metric clamp", () => {
  it("caps the sensible axes of a title that stays <= 8 after flooring, preserving the other axes", () => {
    // A PEGI_7 game: the game floor sets the age from PEGI (max(6,7)=7) WITHOUT
    // reading the axes, so the floored age stays <= 8 and the young clamp then
    // caps the sensible axes. (For films/TV a high axis would raise the age
    // first, so the clamp is a no-op there — that ordering is intentional.)
    const result = applyContentSafetyFloors({
      expertAgeRec: 6,
      metrics: { ...FULL_METRICS, violence: 4, language: 3, consumerism: 5, positiveMessages: 5 },
      genres: ["Aventure"],
      topics: [],
      type: "GAME",
      officialRating: "PEGI_7",
    })
    expect(result.expertAgeRec).toBe(7) // PEGI floor
    expect(result.metrics.violence).toBe(2) // capped (7 <= 8)
    expect(result.metrics.language).toBe(2) // capped
    expect(result.metrics.consumerism).toBe(5) // NOT capped (not a sensible axis)
    expect(result.metrics.positiveMessages).toBe(5) // preserved
  })

  it("does NOT clamp once a high axis has floored the age above 8 (film/TV ordering)", () => {
    const result = applyContentSafetyFloors({
      expertAgeRec: 6,
      metrics: { ...FULL_METRICS, violence: 4 },
      genres: ["Drame"],
      topics: [],
      type: "MOVIE",
      officialRating: null,
    })
    expect(result.expertAgeRec).toBe(14) // violence 4 (live-action) floors to 14
    expect(result.metrics.violence).toBe(4) // NOT capped — no longer a "young" title
  })
})

describe("clampMetricsByAge", () => {
  it("returns metrics unchanged above the young age", () => {
    const m = { violence: 5, sexNudity: 5, language: 5, substanceUse: 5 }
    expect(clampMetricsByAge(m, 12)).toEqual(m)
  })
  it("caps at 2 for a young title and preserves extra fields", () => {
    const m = { violence: 5, sexNudity: 5, language: 5, substanceUse: 5, positiveMessages: 4 }
    expect(clampMetricsByAge(m, 7)).toEqual({
      violence: 2,
      sexNudity: 2,
      language: 2,
      substanceUse: 2,
      positiveMessages: 4,
    })
  })
  it("is a no-op for a null age", () => {
    const m = { violence: 5, sexNudity: 0, language: 0, substanceUse: 0 }
    expect(clampMetricsByAge(m, null)).toEqual(m)
  })
})
