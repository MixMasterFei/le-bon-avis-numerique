// @vitest-environment node
import { existsSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isStaticMetadataFile } from "next/dist/lib/metadata/is-metadata-route"

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findMany: vi.fn(), groupBy: vi.fn() } },
}))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (run: () => unknown) => run() }))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: vi.fn() } }))

import sitemap, { generateSitemaps } from "../sitemap"
import { GET as sitemapIndex } from "../sitemap-index.xml/route"
import { COLLECTIONS } from "@/lib/collections-data"
import { prisma } from "@/lib/prisma"
import { sanityClient } from "@/sanity/client"

const db = vi.mocked(prisma, true)
const cms = vi.mocked(sanityClient, true)
const BASE = "https://totemavise.com"
const NOW = new Date("2026-11-06T12:00:00Z")

const build = (id: string) => sitemap({ id: Promise.resolve(id) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
  db.mediaItem.findMany.mockResolvedValue([] as never)
  db.mediaItem.groupBy.mockResolvedValue([] as never)
  cms.fetch.mockResolvedValue([] as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("sitemap split (generateSitemaps)", () => {
  it("exposes one sitemap per section: pages, films, séries, jeux", async () => {
    expect(await generateSitemaps()).toEqual([{ id: "pages" }, { id: "films" }, { id: "series" }, { id: "jeux" }])
  })

  it.each([
    ["films", "MOVIE", "movie"],
    ["series", "TV", "tv"],
    ["jeux", "GAME", "game"],
  ])("%s lists only public %s fiches, dated by their last content change", async (id, type, prefix) => {
    db.mediaItem.findMany.mockResolvedValue([
      { id: "a1", type, contentUpdatedAt: new Date("2026-09-04T10:00:00Z") },
    ] as never)

    const entries = await build(id)

    const query = db.mediaItem.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      select: Record<string, boolean>
    }
    expect(query.where).toMatchObject({ type, dataQualityScore: { gte: 30 } })
    expect(query.select).toEqual({ id: true, type: true, contentUpdatedAt: true })
    expect(entries).toEqual([
      { url: `${BASE}/media/${prefix}:a1`, lastModified: new Date("2026-09-04T10:00:00Z"), changeFrequency: "weekly", priority: 0.7 },
    ])
  })

  it("pages: static pages (homepage stamped at generation), collections and blog — no catalogue query", async () => {
    cms.fetch.mockResolvedValue([{ slug: "ecrans-et-sommeil", publishedAt: "2026-10-01T08:00:00Z" }] as never)

    const entries = await build("pages")
    const urls = entries.map((e) => e.url)

    // The verification signal for the regeneration fix: this <lastmod> must
    // advance at every ISR regeneration.
    expect(entries[0]).toMatchObject({ url: BASE, lastModified: NOW })
    expect(urls).toContain(`${BASE}/age/2-4`)
    expect(urls).toContain(`${BASE}/collections/${COLLECTIONS[0].id}`)
    expect(urls).toContain(`${BASE}/blog`)
    expect(urls).toContain(`${BASE}/blog/ecrans-et-sommeil`)
    expect(urls.some((u) => u.includes("/media/"))).toBe(false)
    expect(db.mediaItem.findMany).not.toHaveBeenCalled()
  })

  it("returns nothing for an unknown section", async () => {
    expect(await build("livres")).toEqual([])
    expect(db.mediaItem.findMany).not.toHaveBeenCalled()
  })
})

describe("sitemap failure policy", () => {
  it("at runtime a failed query throws, so ISR keeps serving the last good sitemap", async () => {
    db.mediaItem.findMany.mockRejectedValue(new Error("Can't reach database server") as never)
    await expect(build("films")).rejects.toThrow("Can't reach database server")
  })

  it("at runtime a Sanity failure throws too, rather than dropping the blog URLs", async () => {
    cms.fetch.mockRejectedValue(new Error("Sanity down") as never)
    await expect(build("pages")).rejects.toThrow("Sanity down")
  })

  it("during `next build` (CI has no database) it publishes without the failed source", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    db.mediaItem.findMany.mockRejectedValue(new Error("Can't reach database server") as never)
    cms.fetch.mockRejectedValue(new Error("Sanity down") as never)

    expect(await build("films")).toEqual([])
    const pages = await build("pages")
    expect(pages.length).toBeGreaterThan(20)
    expect(pages.some((e) => e.url.includes("/blog"))).toBe(false)
    log.mockRestore()
  })
})

describe("sitemap index at /sitemap.xml", () => {
  it("lists the four sections, dating each catalogue section by its latest content change", async () => {
    db.mediaItem.groupBy.mockResolvedValue([
      { type: "MOVIE", _max: { contentUpdatedAt: new Date("2026-11-05T03:00:00Z") } },
      { type: "GAME", _max: { contentUpdatedAt: new Date("2026-10-30T09:30:00Z") } },
    ] as never)

    const res = await sitemapIndex()
    const xml = await res.text()

    expect(res.headers.get("content-type")).toContain("application/xml")
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.match(/<sitemap>/g)).toHaveLength(4)
    expect(xml).toContain(`<loc>${BASE}/sitemap/pages.xml</loc>\n</sitemap>`)
    expect(xml).toContain(`<loc>${BASE}/sitemap/films.xml</loc>\n<lastmod>2026-11-05T03:00:00.000Z</lastmod>`)
    expect(xml).toContain(`<loc>${BASE}/sitemap/series.xml</loc>\n</sitemap>`)
    expect(xml).toContain(`<loc>${BASE}/sitemap/jeux.xml</loc>\n<lastmod>2026-10-30T09:30:00.000Z</lastmod>`)
  })

  it("still serves a complete index (without dates) when the database fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    db.mediaItem.groupBy.mockRejectedValue(new Error("Timed out") as never)

    const res = await sitemapIndex()
    const xml = await res.text()

    expect(res.status).toBe(200)
    expect(xml.match(/<loc>/g)).toHaveLength(4)
    expect(xml).not.toContain("<lastmod>")
    log.mockRestore()
  })

  it("is served at /sitemap.xml through a rewrite, so robots.txt and Search Console keep their URL", async () => {
    const { default: config } = await import("../../../next.config")
    const rewrites = await config.rewrites!()
    expect(rewrites).toMatchObject({
      beforeFiles: expect.arrayContaining([{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }]),
    })
  })
})

describe("regeneration guard", () => {
  // The root cause of the frozen sitemap: Next 16 exports a prerendered route
  // whose path is a static metadata file as a plain static file, dropping its
  // `revalidate`. Only paths Next does NOT classify that way can regenerate.
  it("serves nothing as a prerendered /sitemap.xml — the path Next would freeze", () => {
    expect(isStaticMetadataFile("/sitemap.xml")).toBe(true)
    const app = path.join(process.cwd(), "src/app")
    expect(existsSync(path.join(app, "sitemap.xml"))).toBe(false)
  })

  it("serves the index and the sections on paths that stay real ISR routes", () => {
    expect(isStaticMetadataFile("/sitemap-index.xml")).toBe(false)
    for (const id of ["pages", "films", "series", "jeux"]) {
      expect(isStaticMetadataFile(`/sitemap/${id}.xml`)).toBe(false)
    }
  })
})
