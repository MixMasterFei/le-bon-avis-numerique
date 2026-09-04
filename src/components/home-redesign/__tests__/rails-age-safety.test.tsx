import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("../parts", () => ({
  CardRailSection: ({ items }: { items: { id: string; title: string }[] }) => <div>{items.map((item) => <span key={item.id}>{item.title}</span>)}</div>,
  Em: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Band: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Wrap: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SectionHead: () => null,
}))
vi.mock("../UpcomingCard", () => ({
  UpcomingCard: ({ item }: { item: { title: string } }) => <span>{item.title}</span>,
}))
vi.mock("../RedesignCard", () => ({
  RedesignCard: ({ media }: { media: { title: string } }) => <span>{media.title}</span>,
}))
vi.mock("../useRankedByFit", () => ({ useRankedByFit: (items: unknown[]) => items }))

import { CinemaRail, TopPicksRail, UpcomingRail } from "../rails"
import { PlatformsSection } from "../PlatformsSection"
import { PersonalizedRail } from "../PersonalizedRail"

const young = { id: "young", title: "Suitable at five", expertAgeRec: 5, posterUrl: null, genres: [], platforms: ["Netflix"] }
const teen = { id: "teen", title: "Suitable at fourteen", expertAgeRec: 14, posterUrl: null, genres: [], platforms: ["Netflix"] }
const unknown = { id: "unknown", title: "Age still unknown", expertAgeRec: null, posterUrl: null, genres: [], platforms: ["Netflix"] }

const neverResponds = () => new Promise<Response>(() => {})
function respondWithMedia() {
  const media = [teen, young, unknown, { ...young, id: "young2", title: "Another young pick" }, { ...young, id: "young3", title: "Third young pick" }]
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ movies: media, items: media, games: media, results: media.map((item) => ({ ...item, mediaId: item.id })) }) })
}

beforeEach(() => { window.sessionStorage.clear() })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("homepage rails when age filters become more restrictive", () => {
  it("immediately removes older cinema cards while a younger-age fetch is pending", async () => {
    const fetchMock = respondWithMedia()
    vi.stubGlobal("fetch", fetchMock)
    const { rerender } = render(<CinemaRail maxAge={15} />)
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    fetchMock.mockImplementation(neverResponds)

    rerender(<CinemaRail maxAge={5} />)
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.getByText(young.title)).toBeInTheDocument()
    expect(screen.queryByText(unknown.title)).not.toBeInTheDocument()
  })

  it("also age-gates persisted cinema results before the server responds", async () => {
    window.sessionStorage.setItem("totem:rail:v1:movies@/api/cinema?maxAge=7#", JSON.stringify({ t: Date.now(), v: [teen, young, unknown] }))
    vi.stubGlobal("fetch", vi.fn(neverResponds))
    render(<CinemaRail maxAge={7} />)
    expect(await screen.findByText(young.title)).toBeInTheDocument()
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.queryByText(unknown.title)).not.toBeInTheDocument()
  })

  it("immediately removes older top picks while all new source requests are pending", async () => {
    const fetchMock = respondWithMedia()
    vi.stubGlobal("fetch", fetchMock)
    const { rerender } = render(<TopPicksRail maxAge={15} state="default" />)
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    fetchMock.mockImplementation(neverResponds)

    rerender(<TopPicksRail maxAge={5} state="default" />)
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.getByText(young.title)).toBeInTheDocument()
    expect(screen.queryByText(unknown.title)).not.toBeInTheDocument()
  })

  it("immediately removes older upcoming releases while refreshing", async () => {
    const fetchMock = respondWithMedia()
    vi.stubGlobal("fetch", fetchMock)
    const { rerender } = render(<UpcomingRail maxAge={15} />)
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    fetchMock.mockImplementation(neverResponds)

    rerender(<UpcomingRail maxAge={5} />)
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.getByText(young.title)).toBeInTheDocument()
    expect(screen.queryByText(unknown.title)).not.toBeInTheDocument()
  })

  it("keeps the streaming provider selection when tightening the age cap", async () => {
    const fetchMock = respondWithMedia()
    vi.stubGlobal("fetch", fetchMock)
    const { rerender } = render(<PlatformsSection maxAge={15} />)
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Disney+" }))
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Voir tout/ })).toHaveAttribute("href", "/films/recherche?platforms=Disney%2B&maxAge=15")
    fetchMock.mockImplementation(neverResponds)

    rerender(<PlatformsSection maxAge={5} />)
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Disney+" })).toHaveAttribute("aria-pressed", "true")
  })

  it("immediately removes older personalized results while refreshing", async () => {
    const fetchMock = respondWithMedia()
    vi.stubGlobal("fetch", fetchMock)
    const { rerender } = render(<PersonalizedRail memberIds={["teen"]} title="Family" maxAge={15} />)
    expect(await screen.findByText(teen.title)).toBeInTheDocument()
    fetchMock.mockImplementation(neverResponds)

    rerender(<PersonalizedRail memberIds={["teen", "child"]} title="Family" maxAge={5} />)
    expect(screen.queryByText(teen.title)).not.toBeInTheDocument()
    expect(screen.getByText(young.title)).toBeInTheDocument()
    expect(screen.queryByText(unknown.title)).not.toBeInTheDocument()
  })
})
