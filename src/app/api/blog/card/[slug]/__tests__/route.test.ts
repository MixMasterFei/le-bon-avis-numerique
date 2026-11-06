// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const cms = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: cms.fetch } }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { GET } from "../route"

const call = (slug: string, query = "") =>
  GET(new NextRequest(`https://totemavise.com/api/blog/card/${slug}${query}`), { params: Promise.resolve({ slug }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/blog/card/[slug]", () => {
  it("renders the titled card of a published post, cached for a day", async () => {
    cms.fetch.mockResolvedValue({ title: "À quel âge voir un film ?", category: "films-series" })
    const res = await call("bon-age-film-enfant")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400")
    const [query, params] = cms.fetch.mock.calls[0]
    expect(query).toContain("publishedAt <= now()")
    expect(query).toContain('!(_id in path("drafts.**"))')
    expect(params).toEqual({ slug: "bon-age-film-enfant" })
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(10_000)
  })

  it("never shows a draft's title: unpublished slug + cat → short-lived category card", async () => {
    cms.fetch.mockResolvedValue(null)
    const res = await call("brouillon-secret", "?cat=films-series")
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300")
  })

  it("404s an unknown slug without category, and ignores a category outside the list", async () => {
    cms.fetch.mockResolvedValue(null)
    expect((await call("inconnu")).status).toBe(404)
    expect((await call("inconnu", "?cat=<script>")).status).toBe(404)
  })

  it("rejects malformed slugs before reaching Sanity", async () => {
    expect((await call("Pas un slug!")).status).toBe(404)
    expect(cms.fetch).not.toHaveBeenCalled()
  })

  it("still renders a card when Sanity is down (no broken image), briefly cached", async () => {
    cms.fetch.mockRejectedValue(new Error("offline"))
    const res = await call("bon-age-film-enfant")
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300")
  })
})
