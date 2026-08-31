import { describe, expect, it } from "vitest"
import robots from "../robots"

type Rule = { userAgent: string; allow: string; disallow: string[] }

const rules = () => (robots().rules as Rule[])
const forAgent = (ua: string) => rules().find((r) => r.userAgent === ua)!

describe("robots.txt", () => {
  it("blocks the /md/ citation layer for search crawlers", () => {
    // Googlebot matches the "*" group. Without this it crawls one
    // /md/media/<id> per fiche, gets noindex, and files each under
    // "Excluded by 'noindex' tag" — 1 175 pages and rising in GSC.
    expect(forAgent("*").disallow).toContain("/md/")
  })

  it("still lets every AI bot read /md/ — that is the whole point of the layer", () => {
    const aiAgents = rules()
      .map((r) => r.userAgent)
      .filter((ua) => ua !== "*")
    expect(aiAgents.length).toBeGreaterThan(0)
    for (const ua of aiAgents) {
      expect(forAgent(ua).disallow).not.toContain("/md/")
    }
  })

  it("keeps the private surfaces blocked for everyone", () => {
    for (const r of rules()) {
      expect(r.disallow).toContain("/admin/")
      expect(r.disallow).toContain("/api/")
      // No trailing slash: the rule has to cover /profil itself, not only its
      // children. Broadened in the crawl-trap fix (#95); this pin lagged behind.
      // Same reason /coin-famille and /inscription are listed bare — those are
      // exactly the URLs crawlers hit.
      expect(r.disallow).toContain("/profil")
      expect(r.disallow).toContain("/coin-famille")
      expect(r.disallow).toContain("/inscription")
      expect(r.disallow).toContain("/decouverte")
    }
  })

  it("advertises the sitemap", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
