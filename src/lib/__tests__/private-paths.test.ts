import { describe, expect, it } from "vitest"
import { PRIVATE_PATHS, isPrivatePath, isAiFacingEndpoint } from "../private-paths"
import robots from "@/app/robots"

describe("isPrivatePath", () => {
  // The surfaces Meta-ExternalAgent actually hammered in Aug 2026:
  // 126 912 fetches of /coin-famille in 5 days, plus /inscription.
  it.each([
    "/coin-famille",
    "/inscription",
    "/profil",
    "/profil/quiz/abc-123",
    "/profil/membres/xyz",
    "/admin",
    "/admin/operations",
    "/api/user/family/1",
    "/chez-vous",
    "/studio/desk",
    "/apercudecouverte",
  ])("blocks %s", (pathname) => {
    expect(isPrivatePath(pathname)).toBe(true)
  })

  // Public surfaces must stay crawlable — this is the site's SEO/AI-visibility
  // strategy, so over-blocking here would be worse than the cost it saves.
  it.each([
    "/",
    "/films",
    "/series",
    "/jeux",
    "/jeux/quel-age",
    "/blog",
    "/blog/temps-decran",
    "/media/movie:0938702a-6142-4bee-9a39-f4cb4b54ce7c",
    "/md/media/tv:c6d051d1-a045-41be-a9dc-4ed698c1dabe",
    "/guides",
    "/age/8-10",
    "/collections",
    "/sitemap.xml",
    "/robots.txt",
  ])("allows %s", (pathname) => {
    expect(isPrivatePath(pathname)).toBe(false)
  })

  it("matches on segment boundaries, not raw prefixes", () => {
    // "/profil" must not swallow an unrelated sibling route.
    expect(isPrivatePath("/profils-publics")).toBe(false)
    expect(isPrivatePath("/films-profil")).toBe(false)
  })

  it("stays in sync with what robots.txt advertises", () => {
    // The enforcement must never block something robots.txt did not ask for.
    const rules = robots().rules as Array<{ userAgent: string; disallow: string[] }>
    const starGroup = rules.find((r) => r.userAgent === "*")!
    for (const path of PRIVATE_PATHS) {
      expect(starGroup.disallow).toContain(path)
    }
  })
})

describe("isAiFacingEndpoint", () => {
  // The MCP server is public, anonymous and read-only — it exists so AI
  // clients can call it. It must survive the crawler enforcement even though
  // it sits under the disallowed /api/ prefix.
  it.each(["/api/mcp", "/api/mcp/mcp", "/api/mcp/sse"])("exempts %s", (pathname) => {
    expect(isPrivatePath(pathname)).toBe(true)
    expect(isAiFacingEndpoint(pathname)).toBe(true)
  })

  it("does not exempt the rest of the private API surface", () => {
    for (const pathname of ["/api/admin/enrich", "/api/user/family/1", "/api/totem/chat"]) {
      expect(isAiFacingEndpoint(pathname)).toBe(false)
    }
    // and must not leak onto a lookalike route
    expect(isAiFacingEndpoint("/api/mcp-internal")).toBe(false)
  })
})
