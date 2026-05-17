import { describe, expect, it } from "vitest"
import {
  computeMemberVector,
  effectiveSensitivity,
  personalizedScore,
  topInferredPreferences,
  EMPTY_VECTOR,
  type ReactionForAggregation,
} from "../index"

function loved(genres: string[], topics: string[] = [], contentMetrics?: {
  violence?: number
  sexNudity?: number
  language?: number
  substanceUse?: number
  toneTags?: string[]
}): ReactionForAggregation {
  return {
    reaction: "LOVED",
    media: { genres, topics, contentMetrics: contentMetrics ?? null },
  }
}

function scared(genres: string[], toneTags: string[] = []): ReactionForAggregation {
  return {
    reaction: "SCARED",
    media: { genres, contentMetrics: { toneTags } },
  }
}

function notForMe(genres: string[]): ReactionForAggregation {
  return {
    reaction: "NOT_FOR_ME",
    source: "quiz_anchor",
    media: { genres },
  }
}

describe("computeMemberVector — aggregation", () => {
  it("returns the empty vector when no reactions feed it", () => {
    const v = computeMemberVector([])
    expect(v.genreWeights).toEqual({})
    expect(v.topicWeights).toEqual({})
    expect(v.toneWeights).toEqual({})
    expect(v.evidenceCount).toBe(0)
  })

  it("LOVED adds +2 per tag and counts as evidence", () => {
    const v = computeMemberVector([loved(["Action", "Aventure"])])
    expect(v.genreWeights["action"]).toBe(2)
    expect(v.genreWeights["aventure"]).toBe(2)
    expect(v.evidenceCount).toBe(1)
  })

  it("LIKED adds +1, WATCHED adds +0.5", () => {
    const v = computeMemberVector([
      { reaction: "LIKED", media: { genres: ["Action"] } },
      { reaction: "WATCHED", media: { genres: ["Action"] } },
    ])
    expect(v.genreWeights["action"]).toBeCloseTo(1.5, 5)
  })

  it("SCARED subtracts strongly on tone tags", () => {
    const v = computeMemberVector([
      loved(["Animation"]),
      scared(["Horreur"], ["Effrayant et angoissant"]),
    ])
    // animation got +2 (LOVED), Horreur got -1.5 (SCARED genre)
    expect(v.genreWeights["animation"]).toBe(2)
    expect(v.genreWeights["horreur"]).toBe(-1.5)
    // Tone tag should carry the same -1.5
    expect(v.toneWeights["effrayant et angoissant"]).toBe(-1.5)
  })

  it("NOT_FOR_ME (quiz anchor) counts as a strong negative", () => {
    const v = computeMemberVector([notForMe(["Horreur"])])
    expect(v.genreWeights["horreur"]).toBe(-2)
  })

  it("normalizes EN / FR / accented variants to the same axis", () => {
    const v = computeMemberVector([
      loved(["Family"]),
      loved(["Famille"]),
      loved(["FAMILY"]),
    ])
    // All three contributed +2 → 6 on the same canonical axis
    expect(v.genreWeights["famille"]).toBe(6)
    // No leftover untranslated keys
    expect(v.genreWeights["family"]).toBeUndefined()
  })
})

describe("computeMemberVector — observedTolerances", () => {
  it("stays null below the 3-evidence threshold (1 LOVED outlier)", () => {
    const v = computeMemberVector([
      loved(["Action"], [], { violence: 5 }),
    ])
    expect(v.observedTolerances.violence).toBeNull()
  })

  it("returns null with 2 LOVED (still below threshold)", () => {
    const v = computeMemberVector([
      loved(["Action"], [], { violence: 4 }),
      loved(["Aventure"], [], { violence: 4 }),
    ])
    expect(v.observedTolerances.violence).toBeNull()
  })

  it("uses P75 once we have ≥3 LOVED+LIKED observations", () => {
    const v = computeMemberVector([
      loved(["A"], [], { violence: 3 }),
      loved(["B"], [], { violence: 4 }),
      loved(["C"], [], { violence: 4 }),
    ])
    // sorted [3, 4, 4], idx = floor(0.75 * 2) = 1 → 4
    expect(v.observedTolerances.violence).toBe(4)
  })

  it("outlier doesn't lift the bar — one John Wick at violence:5 is ignored", () => {
    const v = computeMemberVector([
      loved(["A"], [], { violence: 1 }),
      loved(["B"], [], { violence: 1 }),
      loved(["C"], [], { violence: 5 }), // outlier
    ])
    // sorted [1, 1, 5], idx 1 → 1
    expect(v.observedTolerances.violence).toBe(1)
  })

  it("WATCHED-only reactions don't count toward tolerance evidence", () => {
    const v = computeMemberVector([
      { reaction: "WATCHED", media: { genres: ["A"], contentMetrics: { violence: 5 } } },
      { reaction: "WATCHED", media: { genres: ["B"], contentMetrics: { violence: 5 } } },
      { reaction: "WATCHED", media: { genres: ["C"], contentMetrics: { violence: 5 } } },
    ])
    expect(v.observedTolerances.violence).toBeNull()
    expect(v.evidenceCount).toBe(0)
  })
})

describe("personalizedScore — cosine ranker", () => {
  it("returns neutral 0.5 for an empty / cold-start vector", () => {
    expect(personalizedScore(EMPTY_VECTOR, { genres: ["Action"] })).toBe(0.5)
  })

  it("returns >0.5 when media genres match the member's positive weights", () => {
    const v = computeMemberVector([
      loved(["Action", "Aventure"]),
      loved(["Action"]),
    ])
    const score = personalizedScore(v, { genres: ["Action", "Aventure"] })
    expect(score).toBeGreaterThan(0.5)
  })

  it("returns ≈0.5 when the media has no shared axes with the member vector", () => {
    const v = computeMemberVector([loved(["Action"])])
    const score = personalizedScore(v, { genres: ["Romance"] })
    // No dot-product overlap → cosine = 0 → mapped to 0.5
    expect(score).toBe(0.5)
  })

  it("reflects negative weights as a low score", () => {
    const v = computeMemberVector([
      loved(["Animation"]),
      loved(["Animation"]),
      scared(["Horreur"], []),
    ])
    const horror = personalizedScore(v, { genres: ["Horreur"] })
    const animation = personalizedScore(v, { genres: ["Animation"] })
    expect(horror).toBeLessThan(animation)
  })
})

describe("effectiveSensitivity — three-scale derivation", () => {
  it("returns stated when no observation is available", () => {
    expect(effectiveSensitivity(2, null)).toBe(2)
  })

  it("relaxes by at most one step when behavior suggests tolerance", () => {
    // stated=2, observedP75=5 (very tolerant) → learned=0; cap at stated-1 = 1
    expect(effectiveSensitivity(2, 5)).toBe(1)
  })

  it("doesn't go below stated - 1 even with extreme tolerance", () => {
    expect(effectiveSensitivity(3, 5)).toBe(2)
    expect(effectiveSensitivity(0, 5)).toBe(0) // already at floor
  })

  it("doesn't increase sensitivity above stated even when behavior is timid", () => {
    // stated=1, observedP75=0 (very timid) → learned=3; but capped at min(stated, learned) = 1
    expect(effectiveSensitivity(1, 0)).toBe(1)
  })

  it("Erwan case: stated=0 + LOVED action films → stays at 0", () => {
    expect(effectiveSensitivity(0, 4)).toBe(0)
  })

  it("matrix smoke check — 0..3 × 0..5", () => {
    // Row layout: [stated, observedP75, expectedEffective]
    // Rule recap: relax stated by at most one step when behavior is tolerant
    // (observed high); never increase strictness above stated when behavior
    // is timid (observed low).
    const cases: [number, number, number][] = [
      [0, 0, 0], [0, 5, 0],         // already at floor; can't get more tolerant
      [1, 0, 1], [1, 5, 0],         // tolerant behavior allows -1 step
      [2, 0, 2], [2, 3, 1], [2, 5, 1], // timid behavior leaves stated alone
      [3, 0, 3], [3, 4, 2], [3, 5, 2], // strict stated can relax by 1 at most
    ]
    for (const [stated, observed, expected] of cases) {
      expect(effectiveSensitivity(stated, observed)).toBe(expected)
    }
  })
})

describe("topInferredPreferences", () => {
  it("surfaces the strongest positive axes across genre/topic/tone", () => {
    const v = computeMemberVector([
      loved(["Animation"], ["Espace"]),
      loved(["Animation"]),
      loved(["Aventure"]),
      scared(["Horreur"], ["Effrayant"]),
    ])
    const top = topInferredPreferences(v, 3)
    // Animation is the strongest (+4), Aventure (+2), Espace (+2 topic)
    expect(top[0].key).toBe("animation")
    expect(top.length).toBeLessThanOrEqual(3)
    // Negative axes (horreur, effrayant) must not appear in positives
    expect(top.find((p) => p.key === "horreur")).toBeUndefined()
  })

  it("returns an empty array when no positive signal exists", () => {
    expect(topInferredPreferences(EMPTY_VECTOR)).toEqual([])
  })
})
