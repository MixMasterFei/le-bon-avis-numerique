import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const blog = vi.hoisted(() => ({ getLiveBlogSlugs: vi.fn() }))
vi.mock("@/lib/published-blog", () => blog)
const membership = vi.hoisted(() => ({ isNoelGiftGame: vi.fn() }))
vi.mock("@/lib/noel/gift-membership", () => membership)

import { FicheBlogLink } from "../FicheBlogLink"
import { ParentTipsStrip } from "../ParentTipsStrip"

// The fiche card and the catalogue strips: server-rendered, live articles
// only, and never the article the « Comment lire cet âge ? » link already
// points at.

const LIVE = ["bon-age-film-enfant", "films-qui-font-peur-enfant-pret", "soiree-film-en-famille"]

const seven = {
  type: "MOVIE",
  title: "Seven",
  genres: ["Crime", "Thriller"],
  expertAgeRec: 16,
  sensitiveWarnings: ["Violence intense ou graphique"],
  enrichmentConfidence: 1,
}
const grinch = { type: "MOVIE", title: "Le Grinch", genres: ["Animation", "Familial"], expertAgeRec: 6 }
const odyssey = { type: "GAME", title: "Super Mario Odyssey", genres: ["Plateforme"], expertAgeRec: 7 }

function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(iso))
}

describe("FicheBlogLink", () => {
  beforeEach(() => {
    blog.getLiveBlogSlugs.mockReset().mockResolvedValue(LIVE)
    membership.isNoelGiftGame.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it("links the family article with its real title", async () => {
    render((await FicheBlogLink({ mediaId: "m1", media: grinch, ageGuideHref: "/blog/bon-age-film-enfant" }))!)
    expect(screen.getByRole("link", { name: /Quel film regarder en famille ce soir \?/ })).toHaveAttribute(
      "href",
      "/blog/soiree-film-en-famille",
    )
    expect(screen.getByText("À lire aussi")).toBeInTheDocument()
  })

  it("does not repeat the age-guide article already linked from the age block", async () => {
    expect(await FicheBlogLink({ mediaId: "m2", media: seven, ageGuideHref: "/blog/bon-age-film-enfant" })).toBeNull()
    render((await FicheBlogLink({ mediaId: "m2", media: seven, ageGuideHref: null }))!)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blog/bon-age-film-enfant")
  })

  it("renders nothing when no article is live", async () => {
    blog.getLiveBlogSlugs.mockResolvedValue([])
    expect(await FicheBlogLink({ mediaId: "m1", media: grinch })).toBeNull()
  })

  it("asks the gift list for a game in season only", async () => {
    at("2026-12-02T12:00:00")
    blog.getLiveBlogSlugs.mockResolvedValue([...LIVE, "jeux-video-noel-selon-age"])
    membership.isNoelGiftGame.mockResolvedValue(true)
    render((await FicheBlogLink({ mediaId: "g1", media: odyssey }))!)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blog/jeux-video-noel-selon-age")
    expect(membership.isNoelGiftGame).toHaveBeenCalledWith("g1")

    membership.isNoelGiftGame.mockClear()
    at("2027-01-05T12:00:00")
    expect(await FicheBlogLink({ mediaId: "g1", media: odyssey })).toBeNull()
    expect(membership.isNoelGiftGame).not.toHaveBeenCalled()
  })

  it("never asks the gift list for a film", async () => {
    at("2026-12-02T12:00:00")
    await FicheBlogLink({ mediaId: "m1", media: grinch })
    expect(membership.isNoelGiftGame).not.toHaveBeenCalled()
  })
})

describe("ParentTipsStrip", () => {
  beforeEach(() => blog.getLiveBlogSlugs.mockReset().mockResolvedValue(LIVE))
  afterEach(() => vi.useRealTimers())

  it("lists the live film articles on /films", async () => {
    render((await ParentTipsStrip({ shelf: "films" }))!)
    expect(screen.getByRole("heading", { name: "Conseils pour les parents" })).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(LIVE.map((s) => `/blog/${s}`))
  })

  it("renders nothing on /jeux until a game article is live, and only in season", async () => {
    at("2026-11-27T12:00:00")
    expect(await ParentTipsStrip({ shelf: "jeux" })).toBeNull()

    blog.getLiveBlogSlugs.mockResolvedValue([...LIVE, "jeux-video-noel-selon-age"])
    at("2026-12-02T12:00:00")
    render((await ParentTipsStrip({ shelf: "jeux" }))!)
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/blog/jeux-video-noel-selon-age"])

    at("2027-01-05T12:00:00")
    expect(await ParentTipsStrip({ shelf: "jeux" })).toBeNull()
  })
})
