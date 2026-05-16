import { describe, expect, it } from "vitest"
import { fallbackCard } from "../news-image"

describe("news fallback images", () => {
  it("uses a deterministic seed so same-category fallback cards vary by story", () => {
    const a = fallbackCard("TECH", "Netflix change ses regles familiales")
    const b = fallbackCard("TECH", "TikTok renforce ses controles parentaux")
    const c = fallbackCard("TECH", "Netflix change ses regles familiales")

    expect(a.url).not.toBe(b.url)
    expect(a.url).toBe(c.url)
    expect(a.sourceType).toBe("FALLBACK")
    expect(a.credit).toBe("Totem Avise")
  })
})
