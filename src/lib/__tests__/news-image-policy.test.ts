import { describe, expect, it } from "vitest"
import {
  imageHostFromUrl,
  isBlockedHotlinkImageUrl,
  isCardOnlyImagePublisher,
  isCardOnlyImageUrl,
} from "../news-image-policy"

describe("news image policy", () => {
  it("detects blocked hotlink image hosts", () => {
    expect(isBlockedHotlinkImageUrl("https://cdn.sortiraparis.com/images/800/example.jpg")).toBe(true)
    expect(isBlockedHotlinkImageUrl("https://images.example.com/photo.jpg")).toBe(false)
  })

  it("extracts image hosts safely", () => {
    expect(imageHostFromUrl("https://cdn.sortiraparis.com/images/800/example.jpg")).toBe("cdn.sortiraparis.com")
    expect(imageHostFromUrl("not a url")).toBeNull()
  })

  it("flags card-only publishers, region-tag-insensitively", () => {
    // Feed name and the truncated stored credit both resolve.
    expect(isCardOnlyImagePublisher("Better Internet for Kids (UE)")).toBe(true)
    expect(isCardOnlyImagePublisher("Better Internet for Kids")).toBe(true)
    // Unrelated publishers keep their real photo.
    expect(isCardOnlyImagePublisher("Télérama")).toBe(false)
    expect(isCardOnlyImagePublisher(null)).toBe(false)
  })

  it("flags card-only image hosts (incl. subdomains)", () => {
    expect(isCardOnlyImageUrl("https://better-internet-for-kids.europa.eu/o/rss.png")).toBe(true)
    expect(isCardOnlyImageUrl("https://cdn.better-internet-for-kids.europa.eu/x.png")).toBe(true)
    expect(isCardOnlyImageUrl("https://images.telerama.fr/photo.jpg")).toBe(false)
    expect(isCardOnlyImageUrl(null)).toBe(false)
  })
})
