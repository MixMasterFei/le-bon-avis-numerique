import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const cms = vi.hoisted(() => ({ fetch: vi.fn() }))
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: cms.fetch } }))
vi.mock("@sentry/nextjs", () => sentry)
vi.mock("@/sanity/image", () => ({ urlFor: () => null }))

import BlogPage, { generateMetadata } from "@/app/blog/page"

const post = (slug: string) => ({
  slug,
  title: `Titre ${slug}`,
  excerpt: "Un résumé assez long pour une carte d'article du blog.",
  category: "films-series",
  publishedAt: "2026-11-17T07:00:00.000Z",
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("/blog robots", () => {
  it("stays noindex below two published posts", async () => {
    cms.fetch.mockResolvedValueOnce([])
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true })
    cms.fetch.mockResolvedValueOnce([post("un")])
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true })
  })

  it("becomes indexable from two published posts", async () => {
    cms.fetch.mockResolvedValueOnce([post("un"), post("deux")])
    expect((await generateMetadata()).robots).toEqual({ index: true, follow: true })
  })

  it("asks Sanity for published, non-draft, already-dated posts only", async () => {
    cms.fetch.mockResolvedValueOnce([])
    await generateMetadata()
    const [query, , options] = cms.fetch.mock.calls[0]
    expect(query).toContain('!(_id in path("drafts.**"))')
    expect(query).toContain("publishedAt <= now()")
    expect(options).toMatchObject({ perspective: "published" })
  })

  it("fails closed (noindex) and reports when Sanity is unreachable", async () => {
    cms.fetch.mockRejectedValueOnce(new Error("offline"))
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true })
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { area: "blog", scope: "listing" } })
  })
})

describe("/blog page", () => {
  it("says the articles are unavailable — not « aucun article » — when Sanity fails", async () => {
    cms.fetch.mockRejectedValueOnce(new Error("offline"))
    render(await BlogPage())
    expect(screen.getByRole("status")).toHaveTextContent("Les articles sont momentanément indisponibles")
    expect(screen.queryByText("Aucun article pour le moment")).toBeNull()
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it("keeps the honest empty state when nothing is published yet", async () => {
    cms.fetch.mockResolvedValueOnce([])
    render(await BlogPage())
    expect(screen.getByText("Aucun article pour le moment")).toBeInTheDocument()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it("lists posts with the branded card when they have no photo", async () => {
    cms.fetch.mockResolvedValueOnce([post("bon-age-film-enfant")])
    const { container } = render(await BlogPage())
    expect(screen.getByText("Titre bon-age-film-enfant")).toBeInTheDocument()
    const img = container.querySelector("img")
    expect(img?.getAttribute("src")).toBe("/api/blog/card/bon-age-film-enfant?cat=films-series")
    expect(screen.getByText("17 novembre 2026")).toBeInTheDocument()
  })
})
