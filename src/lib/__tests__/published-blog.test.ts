// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const cms = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: cms.fetch } }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
// Outside a Next request there is no incremental cache: run the function directly.
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }))

import { AGE_GUIDE_POST_SLUG, formatBlogDate, getLiveBlogSlugs, isBlogPostLive } from "../published-blog"

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getLiveBlogSlugs", () => {
  it("reads only visible posts, with a bounded request", async () => {
    cms.fetch.mockResolvedValue(["bon-age-film-enfant", "films-qui-font-peur-enfant-pret", null])
    expect(await getLiveBlogSlugs()).toEqual(["bon-age-film-enfant", "films-qui-font-peur-enfant-pret"])
    const [query, , options] = cms.fetch.mock.calls[0]
    expect(query).toContain("publishedAt <= now()")
    expect(query).toContain('!(_id in path("drafts.**"))')
    expect(options.perspective).toBe("published")
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it("never throws: an unreachable CMS hides blog links instead of breaking the page", async () => {
    cms.fetch.mockRejectedValue(new Error("timeout"))
    await expect(getLiveBlogSlugs()).resolves.toEqual([])
    await expect(isBlogPostLive(AGE_GUIDE_POST_SLUG)).resolves.toBe(false)
  })

  it("knows when the age guide (draft 12) is live", async () => {
    cms.fetch.mockResolvedValue(["films-qui-font-peur-enfant-pret"])
    expect(await isBlogPostLive(AGE_GUIDE_POST_SLUG)).toBe(false)
    cms.fetch.mockResolvedValue(["films-qui-font-peur-enfant-pret", "bon-age-film-enfant"])
    expect(await isBlogPostLive(AGE_GUIDE_POST_SLUG)).toBe(true)
  })
})

describe("formatBlogDate", () => {
  it("formats in Paris time, not the server's UTC", () => {
    expect(formatBlogDate("2026-11-16T23:30:00.000Z")).toBe("17 novembre 2026")
    expect(formatBlogDate("2026-11-17T07:00:00.000Z")).toBe("17 novembre 2026")
  })
})
