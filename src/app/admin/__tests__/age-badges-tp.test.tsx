import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

const nav = vi.hoisted(() => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tag=Animation&type=MOVIE"),
}))
vi.mock("next/navigation", () => nav)
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { role: "ADMIN" } })) }))
const db = vi.hoisted(() => ({
  prisma: {
    ageVote: { groupBy: vi.fn(), findMany: vi.fn() },
    mediaItem: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/prisma", () => db)

import TagsAdminPage from "../tags/page"
import GenerateReviewPage from "../generate/page"
import DisagreedItemsPage from "../disagreed-items/page"

// Admin views. expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap:
// it reads « TP » — never « 0+ », nor the bare « 0 » a `{age && …}` guard
// prints (@/lib/age-label).

const AGE_BADGE = /^(TP|\d+\+)$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("/admin/tags — items carrying a tag", () => {
  it("badges 0 « TP » (no stray « 0 »), 14 « 14+ », and leaves a missing age without a badge", async () => {
    const tagged = (id: string, title: string, expertAgeRec?: number) => ({ id, title, genres: [], topics: ["Animation"], expertAgeRec })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          items: [tagged("a", "Film tous publics", 0), tagged("b", "Film quatorze ans", 14), tagged("c", "Film sans âge")],
        }),
      }),
    )
    render(<TagsAdminPage />)
    await screen.findByText("Film tous publics")
    // title <h3> → CardContent → Card; the badge sits on the poster above.
    const card = (title: string) => within(screen.getByText(title).parentElement!.parentElement!)

    expect(card("Film tous publics").getByText("TP")).toBeInTheDocument()
    expect(card("Film tous publics").queryByText("0")).toBeNull()
    expect(card("Film quatorze ans").getByText("14+")).toBeInTheDocument()
    expect(card("Film sans âge").queryByText(AGE_BADGE)).toBeNull()
  })
})

describe("/admin/generate — generated (or stored) review", () => {
  const generated = (expertAgeRec: number | null) => ({
    success: true,
    source: "database",
    note: "Déjà dans le catalogue.",
    data: {
      id: "media-1",
      tmdbId: 42,
      title: "Le film généré",
      originalTitle: "Le film généré",
      type: "MOVIE",
      releaseDate: "2020-06-01",
      posterUrl: "",
      synopsisFr: "Synopsis.",
      genres: [],
      expertAgeRec,
      contentMetrics: { violence: 0, sexNudity: 0, language: 0, consumerism: 0, substanceUse: 0, positiveMessages: 3, roleModels: 3 },
      whatParentsNeedToKnow: [],
    },
  })

  async function generate(expertAgeRec: number | null) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => generated(expertAgeRec) }))
    const view = render(<GenerateReviewPage />)
    fireEvent.change(screen.getByPlaceholderText(/ID TMDB/), { target: { value: "42" } })
    fireEvent.click(screen.getByRole("button", { name: "Generer" }))
    await screen.findByText("Le film généré")
    return view
  }

  it("reads « TP » for a stored « Tous publics » title, never « 0+ »", async () => {
    await generate(0)
    expect(screen.getByText("Age recommande: TP")).toBeInTheDocument()
    expect(screen.queryByText("Age recommande: 0+")).toBeNull()
  })

  it("keeps « 12+ », and says « non défini » instead of a stray « + » for an unknown age", async () => {
    const { unmount } = await generate(12)
    expect(screen.getByText("Age recommande: 12+")).toBeInTheDocument()
    unmount()

    await generate(null)
    expect(screen.getByText("Age recommande: non défini")).toBeInTheDocument()
  })
})

describe("/admin/disagreed-items — community disagreements", () => {
  it("shows « actuelle : TP » for a « Tous publics » title, never « 0+ »", async () => {
    const media = [
      { id: "a", title: "Film tous publics", type: "MOVIE", posterUrl: null, expertAgeRec: 0 },
      { id: "b", title: "Film dix ans", type: "MOVIE", posterUrl: null, expertAgeRec: 10 },
      { id: "c", title: "Film sans âge", type: "MOVIE", posterUrl: null, expertAgeRec: null },
    ]
    // 1 agree / 4 disagree each → 20 % d'accord, under the 50 % threshold.
    db.prisma.ageVote.groupBy.mockResolvedValue(
      media.flatMap((m) => [
        { mediaId: m.id, agree: true, _count: { _all: 1 } },
        { mediaId: m.id, agree: false, _count: { _all: 4 } },
      ]),
    )
    db.prisma.mediaItem.findMany.mockResolvedValue(media)
    db.prisma.ageVote.findMany.mockResolvedValue([{ mediaId: "a", suggestedAge: 6 }])

    render(await DisagreedItemsPage())

    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText("actuelle : TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film dix ans/ })).getByText("actuelle : 10+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film sans âge/ })).queryByText(/actuelle/)).toBeNull()
    expect(screen.queryByText("actuelle : 0+")).toBeNull()
    expect(nav.redirect).not.toHaveBeenCalled()
  })
})
