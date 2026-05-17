import { describe, expect, it } from "vitest"
import {
  ageVerdictFromAges,
  familyFitLabelFromScore,
  legacyLevelFromPillars,
  type AgePillar,
  type PreferencePillar,
} from "../family-fit-display"
import type { FitLevel } from "../family-fit-score"

describe("family fit display bands", () => {
  it("keeps guarded 65 scores in the review band", () => {
    expect(familyFitLabelFromScore(65)).toBe("\u00c0 v\u00e9rifier")
  })

  it("shows good choice only above the cautious guardrail cap", () => {
    expect(familyFitLabelFromScore(66)).toBe("Bon choix")
  })

  it("uses a distinct label for clearly unsuitable scores", () => {
    expect(familyFitLabelFromScore(30)).toBe("Trop t\u00f4t")
  })
})

describe("ageVerdictFromAges (Phase 0.2)", () => {
  it("returns ok when memberAge >= expertAgeRec", () => {
    expect(ageVerdictFromAges(14, 10).pillar).toBe("ok")
    expect(ageVerdictFromAges(10, 10).pillar).toBe("ok")
  })

  it("returns borderline when gap is exactly 1", () => {
    expect(ageVerdictFromAges(10, 11).pillar).toBe("borderline")
  })

  it("returns tooEarly when gap is 2+", () => {
    expect(ageVerdictFromAges(10, 12).pillar).toBe("tooEarly")
    expect(ageVerdictFromAges(9, 16).pillar).toBe("tooEarly")
  })

  it("returns unknown when either age is missing", () => {
    expect(ageVerdictFromAges(null, 10).pillar).toBe("unknown")
    expect(ageVerdictFromAges(14, null).pillar).toBe("unknown")
  })

  it("includes a factual detail string when both ages are known", () => {
    const v = ageVerdictFromAges(14, 10)
    expect(v.detail).toContain("14 ans")
    expect(v.detail).toContain("10 ans")
  })

  it("returns tooLate when the content is far too young", () => {
    expect(ageVerdictFromAges(16, 6).pillar).toBe("tooLate")
  })
})

describe("legacyLevelFromPillars (Phase 0.2) — full 5x5 decision table", () => {
  // First match wins; matrix is the documented contract from the plan.
  const expected: Record<AgePillar, Record<PreferencePillar, FitLevel>> = {
    ok: {
      love: "excellent",
      good: "good",
      check: "moderate",
      avoid: "poor",
      noProfile: "good",
    },
    borderline: {
      love: "moderate",
      good: "moderate",
      check: "moderate",
      avoid: "poor",
      noProfile: "moderate",
    },
    tooEarly: {
      love: "poor",
      good: "poor",
      check: "poor",
      avoid: "poor",
      noProfile: "poor",
    },
    // tooLate = content is years younger than the member. Now treated as a
    // taste signal (not a safety hard-reject), so the pref pillar decides.
    // Only an explicit "avoid" still maps to poor.
    tooLate: {
      love: "good",
      good: "good",
      check: "moderate",
      avoid: "poor",
      noProfile: "good",
    },
    unknown: {
      love: "good",
      good: "moderate",
      check: "moderate",
      avoid: "poor",
      noProfile: "moderate",
    },
  }

  for (const age of Object.keys(expected) as AgePillar[]) {
    for (const pref of Object.keys(expected[age]) as PreferencePillar[]) {
      it(`age=${age} × pref=${pref} → ${expected[age][pref]}`, () => {
        expect(legacyLevelFromPillars(age, pref)).toBe(expected[age][pref])
      })
    }
  }
})
