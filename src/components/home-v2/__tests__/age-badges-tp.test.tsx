import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

// Chrome and session/fetch-driven widgets around the badges — stubbed so each
// test renders only what decides how an age is written.
vi.mock("@/components/ui/SafeImage", () => ({ SafeImage: () => null }))
vi.mock("@/components/home/HeroSearch", () => ({ HeroSearch: () => null }))
vi.mock("../ApercuPreviewBanner", () => ({ ApercuPreviewBanner: () => null }))
vi.mock("../ApercuNav", () => ({ ApercuNav: () => null }))
vi.mock("../ApercuFooter", () => ({ ApercuFooter: () => null }))
vi.mock("../NewsStoryActions", () => ({ NewsStoryActions: () => null }))
vi.mock("../ApercuSimilarMedia", () => ({ ApercuSimilarMedia: () => null }))
vi.mock("../ApercuFamilyFit", () => ({ ApercuFamilyFit: () => null }))
vi.mock("@/components/home/FamilyFitProvider", () => ({ FamilyFitProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/media/AgeVoteButton", () => ({ AgeVoteButton: () => null }))
vi.mock("@/components/media/MediaPageClient", () => ({ MediaPageClient: () => null }))
vi.mock("@/components/media/AdminScreenshotsWrapper", () => ({ AdminScreenshotsWrapper: () => null }))
vi.mock("@/components/media/ReviewsSection", () => ({ ReviewsSection: () => null }))
vi.mock("@/components/media/WatchProvidersClient", () => ({ WatchProvidersClient: () => null }))
vi.mock("@/components/media/FamilyReactions", () => ({ FamilyReactions: () => null }))
vi.mock("@/components/media/ReportCorrectionButton", () => ({ ReportCorrectionButton: () => null }))
vi.mock("@/components/media/DualMetricsDisplay", () => ({ DualMetricsDisplay: () => null }))

import { ApercuDecouverteStory, type ApercuStoryDetail, type RelatedMediaCard } from "../ApercuDecouverteStory"
import { ApercuHomepageHeroV2 } from "../ApercuHomepageHeroV2"
import { HomepageWeeklyForFamilies } from "../HomepageWeeklyForFamilies"
import { ApercuFilm } from "../ApercuFilm"
import { CinemaTendancesCard } from "../CinemaTendancesCard"

// expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap: badges read
// « TP », never « 0+ » (@/lib/age-label). Only null may stay badge-less.

const AGE_BADGE = /^(TP|\d+\+)$/

/** fetch stub answering by URL prefix. */
function serve(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix))
      return key ? { ok: true, json: async () => routes[key] } : { ok: false, json: async () => null }
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ApercuDecouverteStory — « À découvrir sur Totem Avisé » cards", () => {
  const related = (id: string, title: string, expertAgeRec: number | null): RelatedMediaCard => ({
    id,
    title,
    type: "MOVIE",
    posterUrl: null,
    expertAgeRec,
    genres: [],
    releaseYear: null,
  })
  const story: ApercuStoryDetail = {
    id: "story",
    slug: "story",
    title: "Une découverte",
    summary: "Résumé.",
    body: "Le corps de l'article.",
    category: "ALL",
    imageUrl: "https://example.org/image.jpg",
    publishedAt: "2026-11-01T10:00:00.000Z",
    sources: [],
    relatedMediaList: [related("a", "Film tous publics", 0), related("b", "Film dix ans", 10), related("c", "Film sans âge", null)],
  }

  it("badges a « Tous publics » title « TP », never « 0+ »", () => {
    render(<ApercuDecouverteStory story={story} serifClass="font-serif" />)

    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film dix ans/ })).getByText("10+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film sans âge/ })).queryByText(AGE_BADGE)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})

describe("ApercuHomepageHeroV2 — hero poster stack", () => {
  const pick = (id: string, title: string, expertAgeRec: number | null) => ({
    id,
    type: "MOVIE",
    title,
    posterUrl: `/posters/${id}.jpg`,
    expertAgeRec,
    genres: [],
  })

  it("badges a « Tous publics » pick « TP », never « 0+ »", async () => {
    serve({
      "/api/db/expert-picks": {
        items: [pick("a", "Choix tous publics", 0), pick("b", "Choix douze ans", 12), pick("c", "Choix sans âge", null)],
      },
    })
    render(<ApercuHomepageHeroV2 serifClass="font-serif" isLoggedIn={false} />)

    const tpLink = await screen.findByRole("link", { name: /Choix tous publics/ })
    expect(within(tpLink).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Choix douze ans/ })).getByText("12+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Choix sans âge/ })).queryByText(AGE_BADGE)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})

describe("HomepageWeeklyForFamilies — « Cette semaine pour les familles »", () => {
  const weekly = (cinemaAge: number | null, gameAge: number | null) =>
    serve({
      "/api/cinema": { movies: [{ id: "film", title: "Le film de la semaine", posterUrl: null, expertAgeRec: cinemaAge }] },
      "/api/db/games": { games: [{ id: "jeu", title: "Le jeu de la semaine", posterUrl: null, expertAgeRec: gameAge }] },
    })

  it("badges a « Tous publics » game (and film) « TP », never « 0+ »", async () => {
    weekly(0, 0)
    render(<HomepageWeeklyForFamilies serifClass="font-serif" />)

    const gameCard = await screen.findByRole("link", { name: /Le jeu de la semaine/ })
    expect(within(gameCard).getByText("TP")).toBeInTheDocument()
    expect(within(await screen.findByRole("link", { name: /Le film de la semaine/ })).getByText("TP")).toBeInTheDocument()
    expect(screen.queryByText("0+")).toBeNull()
  })

  it("keeps « 12+ » for a rated game and the « Jeux » fallback for an unknown age", async () => {
    weekly(null, 12)
    const { unmount } = render(<HomepageWeeklyForFamilies serifClass="font-serif" />)
    expect(within(await screen.findByRole("link", { name: /Le jeu de la semaine/ })).getByText("12+")).toBeInTheDocument()
    unmount()

    weekly(null, null)
    render(<HomepageWeeklyForFamilies serifClass="font-serif" />)
    expect(within(await screen.findByRole("link", { name: /Le jeu de la semaine/ })).getByText("Jeux")).toBeInTheDocument()
  })
})

describe("ApercuFilm — the hero's age card", () => {
  const film = (expertAgeRec: number | null) => ({
    id: "film",
    title: "Le film de référence",
    originalTitle: null,
    type: "MOVIE" as const,
    posterUrl: null,
    backdropUrl: null,
    synopsisFr: null,
    releaseDate: "2020-06-01",
    duration: null,
    director: null,
    genres: [],
    topics: [],
    platforms: [],
    expertAgeRec,
    communityAgeRec: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    officialRating: null,
    contentMetrics: null,
    screenshots: [],
    reviews: [],
  })
  // Circle + « Recommandation » + the line under it, in one card.
  const ageCard = () => within(screen.getByText("Recommandation").parentElement!.parentElement!)

  it("shows « TP » and « Tous publics » for 0, never « 0+ » / « dès 0 ans »", () => {
    render(<ApercuFilm media={film(0)} serifClass="font-serif" />)

    expect(ageCard().getByText("TP")).toBeInTheDocument()
    expect(ageCard().getByText("Tous publics")).toBeInTheDocument()
    expect(screen.queryByText("0+")).toBeNull()
    expect(screen.queryByText(/dès 0 ans/i)).toBeNull()
  })

  it("keeps « 10+ » / « dès 10 ans », and no card when the age is unknown", () => {
    const { unmount } = render(<ApercuFilm media={film(10)} serifClass="font-serif" />)
    expect(ageCard().getByText("10+")).toBeInTheDocument()
    expect(ageCard().getByText("dès 10 ans")).toBeInTheDocument()
    unmount()

    render(<ApercuFilm media={film(null)} serifClass="font-serif" />)
    expect(screen.queryByText("Recommandation")).toBeNull()
  })
})

describe("CinemaTendancesCard — « Au cinéma cette semaine »", () => {
  const tendance = (id: string, title: string, expertAgeRec: number | null) => ({
    id,
    tmdbId: 1,
    title,
    posterUrl: `/posters/${id}.jpg`,
    expertAgeRec,
    inDatabase: true,
  })

  it("badges 0 « TP » and writes the poster alt « — pour tous publics », never « — dès 0 ans »", () => {
    render(
      <CinemaTendancesCard
        serifClass="font-serif"
        tendances={[tendance("a", "Film tous publics", 0), tendance("b", "Film dix ans", 10), tendance("c", "Film sans âge", null)]}
      />,
    )

    expect(screen.getByAltText("Film tous publics — pour tous publics")).toBeInTheDocument()
    expect(screen.getByAltText("Film dix ans — dès 10 ans")).toBeInTheDocument()
    expect(screen.getByAltText("Film sans âge")).toBeInTheDocument()
    expect(screen.queryByAltText(/dès 0 ans/)).toBeNull()
    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText("TP")).toBeInTheDocument()
  })
})
