// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const cms = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: cms.fetch } }))
vi.mock("@/sanity/image", () => ({ urlFor: () => null }))
import { GET } from "@/app/md/blog/[slug]/route"
import { GET as index } from "@/app/md/blog/route"
beforeEach(() => vi.clearAllMocks())
describe("published blog export", () => {
  it("requests published content with explicit draft and future-date exclusions", async () => {
    cms.fetch.mockResolvedValue(null)
    const response = await GET(new Request("https://totemavise.com/md/blog/draft"), { params: Promise.resolve({ slug: "draft" }) })
    expect(response.status).toBe(404)
    const [query, params, options] = cms.fetch.mock.calls[0]
    expect(query).toContain('!(_id in path("drafts.**"))')
    expect(query).toContain("publishedAt <= now()")
    expect(params).toEqual({ slug: "draft" })
    expect(options.perspective).toBe("published")
  })
  it("exports the article with authorship, source links and canonical headers", async () => {
    cms.fetch.mockResolvedValue({ title: "Un guide", slug: "un-guide", author: "Totem Avisé", publishedAt: "2026-09-01T10:00:00Z", _updatedAt: "2026-09-02T10:00:00Z", excerpt: "Des repères.", body: [
      { _type: "block", children: [{ _type: "span", text: "Source", marks: ["link"] }], markDefs: [{ _key: "link", _type: "link", href: "https://example.org/source" }] },
    ] })
    const response = await GET(new Request("https://totemavise.com"), { params: Promise.resolve({ slug: "un-guide" }) })
    expect(response.headers.get("link")).toBe('<https://totemavise.com/blog/un-guide>; rel="canonical"')
    expect(response.headers.get("x-robots-tag")).toBe("noindex, follow")
    const text = await response.text()
    expect(text).toContain("Auteur: Totem Avisé")
    expect(text).toContain("2026-09-01T10:00:00Z")
    expect(text).toContain("[Source](https://example.org/source)")
  })
  it("keeps an empty publication calendar empty", async () => {
    cms.fetch.mockResolvedValue([])
    const response = await index()
    expect(await response.text()).toContain("Aucun article publié")
  })
  it("reports CMS outages as 503, not missing content", async () => {
    cms.fetch.mockRejectedValue(new Error("offline"))
    const response = await index()
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})
