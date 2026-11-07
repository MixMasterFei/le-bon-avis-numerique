import { describe, expect, it } from "vitest"
import { EVAL_SCENARIOS, selectScenarios } from "../scenarios"
import { EVAL_FAMILY } from "../family"
import { EVAL_CATEGORIES } from "../types"
import { estimateRunCostUsd } from "../report"

describe("the scenario set", () => {
  it("has about fifty scenarios with unique ids", () => {
    const ids = EVAL_SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(45)
  })

  it("covers every category", () => {
    for (const cat of EVAL_CATEGORIES) {
      expect(EVAL_SCENARIOS.some((s) => s.category === cat), cat).toBe(true)
    }
  })

  it("includes multi-turn scenarios (memory, repeats, ignored card)", () => {
    expect(EVAL_SCENARIOS.filter((s) => s.turns.length > 1).length).toBeGreaterThanOrEqual(4)
  })

  it("only references subjects, members and pages that exist", () => {
    const names = new Set(EVAL_FAMILY.map((m) => m.name))
    for (const s of EVAL_SCENARIOS) {
      const subjects = new Set(Object.keys(s.subjects ?? {}))
      for (const t of s.turns) {
        for (const k of t.expect?.subjects ?? []) expect(subjects.has(k), `${s.id}: ${k}`).toBe(true)
        for (const n of t.expect?.audience?.members ?? []) expect(names.has(n), `${s.id}: ${n}`).toBe(true)
        if (t.expect?.audience?.members?.length) expect(s.family, s.id).toBe("eval")
      }
      for (const seen of s.seen ?? []) {
        expect(subjects.has(seen.subject), s.id).toBe(true)
        expect(names.has(seen.member), s.id).toBe(true)
      }
      if (s.sourcePage && "subject" in s.sourcePage) expect(subjects.has(s.sourcePage.subject), s.id).toBe(true)
    }
  })

  it("never hard-codes an age: subjects are title queries resolved at run time", () => {
    for (const s of EVAL_SCENARIOS)
      for (const q of Object.values(s.subjects ?? {})) {
        expect(Object.keys(q).every((k) => ["q", "type", "exact"].includes(k)), s.id).toBe(true)
      }
  })

  it("has regexes that compile", () => {
    for (const s of EVAL_SCENARIOS)
      for (const t of s.turns)
        for (const src of [...(t.expect?.mustMatchAny ?? []), ...(t.expect?.mustNotMatch ?? [])]) {
          expect(() => new RegExp(src), `${s.id}: ${src}`).not.toThrow()
        }
  })

  it("selects suites", () => {
    expect(selectScenarios("full")).toHaveLength(EVAL_SCENARIOS.length)
    expect(selectScenarios("smoke").length).toBeGreaterThan(3)
    expect(selectScenarios("crisis").every((s) => s.category === "crisis")).toBe(true)
    expect(selectScenarios("full", ["age-interstellar"]).map((s) => s.id)).toEqual(["age-interstellar"])
  })

  it("estimates a run's cost from the measured token profile", () => {
    const live = estimateRunCostUsd(EVAL_SCENARIOS, undefined)
    expect(live.turns).toBeGreaterThanOrEqual(55)
    // Baseline finding: none of the crisis phrasings (« veut mourir », « on le
    // frappe », « se fait harceler », « je me fais du mal ») matches the
    // router's grave keywords, so the live estimate is all default model.
    expect(Object.keys(live.byModel)).toEqual(["claude-haiku-4-5-20251001"])
    const haiku55 = estimateRunCostUsd(EVAL_SCENARIOS, "claude-haiku-5-5").usd!
    const sonnet55 = estimateRunCostUsd(EVAL_SCENARIOS, "claude-sonnet-5-5").usd!
    expect(haiku55).toBeLessThan(live.usd!)
    expect(sonnet55).toBeGreaterThan(live.usd!)
  })
})
