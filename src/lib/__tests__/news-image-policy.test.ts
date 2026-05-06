import { describe, expect, it } from "vitest"
import { imageHostFromUrl, isBlockedHotlinkImageUrl } from "../news-image-policy"

describe("news image policy", () => {
  it("detects blocked hotlink image hosts", () => {
    expect(isBlockedHotlinkImageUrl("https://cdn.sortiraparis.com/images/800/example.jpg")).toBe(true)
    expect(isBlockedHotlinkImageUrl("https://images.example.com/photo.jpg")).toBe(false)
  })

  it("extracts image hosts safely", () => {
    expect(imageHostFromUrl("https://cdn.sortiraparis.com/images/800/example.jpg")).toBe("cdn.sortiraparis.com")
    expect(imageHostFromUrl("not a url")).toBeNull()
  })
})
