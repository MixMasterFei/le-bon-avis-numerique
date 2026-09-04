import { describe, it, expect } from "vitest"
import { portableTextMarkdown, editorialUrl } from "./portable-text"
describe("published article Markdown", () => {
  it("preserves headings, emphasis, quotations, lists and source URLs", () => {
    const result = portableTextMarkdown([
      { _type: "block", style: "h2", children: [{ _type: "span", text: "Sources" }] },
      { _type: "block", children: [{ _type: "span", text: "Lire la source", marks: ["strong", "source"] }], markDefs: [{ _key: "source", _type: "link", href: "https://example.org/document" }] },
      { _type: "block", style: "blockquote", children: [{ _type: "span", text: "Citation\nsuite" }] },
      { _type: "block", listItem: "number", children: [{ _type: "span", text: "Étape" }] },
      { _type: "block", listItem: "bullet", level: 2, children: [{ _type: "span", text: "Détail" }] },
      { _type: "image", alt: "Une famille", caption: "Légende" },
    ], "https://totemavise.com", () => "https://cdn.sanity.io/image.jpg")
    expect(result).toContain("## Sources")
    expect(result).toContain("[**Lire la source**](https://example.org/document)")
    expect(result).toContain("> Citation\n> suite")
    expect(result).toContain("1. Étape")
    expect(result).toContain("    - Détail")
    expect(result).toContain("![Une famille](https://cdn.sanity.io/image.jpg)")
    expect(result).toContain("Légende")
  })
  it("makes internal references absolute and rejects active URL schemes", () => {
    expect(editorialUrl("/blog/guide", "https://totemavise.com")).toBe("https://totemavise.com/blog/guide")
    expect(editorialUrl("javascript:alert(1)", "https://totemavise.com")).toBeNull()
    expect(editorialUrl("data:text/html,hello", "https://totemavise.com")).toBeNull()
  })
})
