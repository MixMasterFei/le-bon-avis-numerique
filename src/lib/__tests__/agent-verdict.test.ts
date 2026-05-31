import { describe, expect, it } from "vitest"
import { verdictLine, withVerdict } from "../agent-verdict"

describe("agent verdict line", () => {
  it("says nothing-to-do when count is 0 (or negative)", () => {
    expect(verdictLine({ count: 0 })).toBe("✅ RIEN À FAIRE — pour information.")
    expect(verdictLine({ count: -1, kind: "opportunity", top: "x" })).toContain("RIEN À FAIRE")
  })

  it("flags action with the count and top item", () => {
    const line = verdictLine({ count: 2, kind: "action", top: "job X en erreur" })
    expect(line).toContain("⚠️ ACTION : 2")
    expect(line).toContain("job X en erreur")
  })

  it("frames opportunities distinctly from required actions, pluralising", () => {
    expect(verdictLine({ count: 1, kind: "opportunity" })).toContain("💡 1 OPPORTUNITÉ")
    expect(verdictLine({ count: 5, kind: "opportunity" })).toContain("5 OPPORTUNITÉS")
    expect(verdictLine({ count: 1, kind: "opportunity" })).not.toContain("ACTION")
  })

  it("defaults to action kind", () => {
    expect(verdictLine({ count: 1 })).toContain("ACTION")
  })

  it("withVerdict prepends the line above the body", () => {
    const out = withVerdict("corps du rapport", { count: 0 })
    expect(out.startsWith("✅ RIEN À FAIRE")).toBe(true)
    expect(out).toContain("corps du rapport")
    // verdict line, blank line, then body
    expect(out.split("\n\n")[0]).toBe("✅ RIEN À FAIRE — pour information.")
  })
})
