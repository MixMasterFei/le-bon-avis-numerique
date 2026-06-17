import { describe, expect, it } from "vitest"
import { EXPECTATIONS, runExpectationChecks } from "../expectations"

describe("expectations registry", () => {
  const results = runExpectationChecks()

  it("runs one check per registered expectation", () => {
    expect(results).toHaveLength(EXPECTATIONS.length)
  })

  it("has unique ids", () => {
    const ids = EXPECTATIONS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The contract: every hard invariant must currently hold. A failure here means
  // a safety/product constant drifted from its expected value.
  it.each(results.filter((r) => r.severity === "invariant"))(
    "invariant holds: $id",
    (r) => {
      expect(r.ok, `${r.id} — ${r.detail}`).toBe(true)
    },
  )
})
