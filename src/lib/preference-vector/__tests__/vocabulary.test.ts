import { describe, expect, it } from "vitest"
import { normalizeTag, normalizeTags } from "../vocabulary"

describe("normalizeTag — accent folding + lowercasing", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag("  Action  ")).toBe("action")
  })

  it("folds French accents", () => {
    expect(normalizeTag("Comédie")).toBe("comedie")
    expect(normalizeTag("Éducation")).toBe("educatif") // also alias-mapped
  })

  it("collapses extra whitespace", () => {
    expect(normalizeTag("Science  Fiction")).toBe("science-fiction")
  })

  it("returns empty for empty input", () => {
    expect(normalizeTag("")).toBe("")
  })
})

describe("normalizeTag — alias map (EN → FR canonical)", () => {
  it("maps Family / Familial → famille", () => {
    expect(normalizeTag("Family")).toBe("famille")
    expect(normalizeTag("Familial")).toBe("famille")
    expect(normalizeTag("Famille")).toBe("famille")
  })

  it("collapses sci-fi variants", () => {
    expect(normalizeTag("Sci-Fi")).toBe("science-fiction")
    expect(normalizeTag("SciFi")).toBe("science-fiction")
    expect(normalizeTag("Science Fiction")).toBe("science-fiction")
  })

  it("maps Horror → horreur", () => {
    expect(normalizeTag("Horror")).toBe("horreur")
  })

  it("leaves unaliased tags lowercased", () => {
    expect(normalizeTag("Aviation")).toBe("aviation")
  })
})

describe("normalizeTags — array dedup", () => {
  it("removes duplicates after normalization", () => {
    expect(normalizeTags(["Family", "Famille", "FAMILY"])).toEqual(["famille"])
  })

  it("preserves first-seen order", () => {
    expect(normalizeTags(["Animation", "Famille", "Action"])).toEqual(["animation", "famille", "action"])
  })

  it("drops empty / whitespace entries", () => {
    expect(normalizeTags(["", "  ", "Action"])).toEqual(["action"])
  })
})
