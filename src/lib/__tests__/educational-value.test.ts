import { describe, expect, it } from "vitest"
import { deriveEducationalValue } from "../educational-value"
const metrics = { positiveMessages: 4, roleModels: 3 }
describe("derived educational indicator", () => {
  it.each(["Science-Fiction", "science fiction", "Une histoire d'amour", "Culture du secret"])("does not boost a substring match: %s", (topic) => {
    expect(deriveEducationalValue(metrics, [topic])).toBe(2)
  })
  it("recognizes explicit normalized educational topics", () => {
    expect(deriveEducationalValue(metrics, [" ÉDUCATIF "])).toBe(5)
    expect(deriveEducationalValue(metrics, ["Sciences"])).toBe(4)
  })
})
