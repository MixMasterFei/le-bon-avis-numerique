import { describe, expect, it } from "vitest"
import { aiWarningsState } from "../sensitive-warnings"

// F02 — an empty « Ce qui peut marquer » list must never read as an
// affirmative « no concern ». Three honest states, one rule shared by the fiche
// and the /md + MCP layer.
describe("aiWarningsState", () => {
  it("never computed is « no data », not « nothing found »", () => {
    expect(aiWarningsState({ warnings: [], assessedAt: null, confidence: 0.9 })).toEqual({ state: "no_data", items: [] })
    expect(aiWarningsState({ warnings: undefined, assessedAt: undefined, confidence: undefined })).toEqual({ state: "no_data", items: [] })
  })

  it("a pass below the confidence gate is « no data », and its flags stay hidden", () => {
    expect(aiWarningsState({ warnings: ["Noyade"], assessedAt: "2026-08-04", confidence: 0.4 })).toEqual({ state: "no_data", items: [] })
  })

  it("a confident pass that flagged nothing is « nothing flagged » — reported as such, never as safe", () => {
    // « Amélie et la métaphysique des tubes », as the live site stores it
    // (basic pass, confidence 0.72, warnings computed and empty).
    expect(aiWarningsState({ warnings: [], assessedAt: "2026-08-04T06:29:35.016Z", confidence: 0.72 })).toEqual({ state: "nothing_flagged", items: [] })
  })

  it("shows confident flags, including legacy ones that predate the timestamp", () => {
    expect(aiWarningsState({ warnings: ["Noyade", "Guerre"], assessedAt: "2026-08-04", confidence: 0.8 })).toEqual({ state: "flagged", items: ["Noyade", "Guerre"] })
    expect(aiWarningsState({ warnings: ["Noyade"], assessedAt: null, confidence: 0.8 }).state).toBe("flagged")
  })
})
