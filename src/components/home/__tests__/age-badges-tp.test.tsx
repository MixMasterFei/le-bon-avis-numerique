import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, status: "authenticated" }),
}))
vi.mock("@/components/ui/MemberAvatar", () => ({ MemberAvatar: () => null }))

import { HeroSearch } from "../HeroSearch"
import { FamilyRecommendations } from "../FamilyRecommendations"

// expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap: badges read
// « TP », never « 0+ » (@/lib/age-label). Only null may stay badge-less.

const AGE_BADGE = /^(TP|\d+\+)$/

/** fetch stub answering by URL prefix. */
function serve(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix))
      return key ? { ok: true, json: async () => routes[key] } : { ok: false, json: async () => ({}) }
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe("HeroSearch — autocomplete dropdown", () => {
  const suggestion = (id: string, title: string, ageRec: number | null) => ({
    id,
    title,
    type: "MOVIE",
    posterUrl: null,
    year: null,
    ageRec,
  })

  it("badges a « Tous publics » suggestion « TP », never « 0+ »", async () => {
    serve({
      "/api/autocomplete": {
        suggestions: [
          suggestion("a", "Dessin animé tous publics", 0),
          suggestion("b", "Dessin animé sept ans", 7),
          suggestion("c", "Dessin animé sans âge", null),
        ],
      },
    })
    render(<HeroSearch />)
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un film/), { target: { value: "dessin" } })

    // Real timers: the field debounces 200 ms before fetching.
    const tpRow = await screen.findByRole("button", { name: /Dessin animé tous publics/ }, { timeout: 3000 })
    expect(within(tpRow).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("button", { name: /Dessin animé sept ans/ })).getByText("7+")).toBeInTheDocument()
    expect(within(screen.getByRole("button", { name: /Dessin animé sans âge/ })).queryByText(AGE_BADGE)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})

describe("FamilyRecommendations — « Recommandations pour votre famille »", () => {
  const rec = (id: string, title: string, expertAgeRec: number | null) => ({
    id,
    title,
    type: "MOVIE",
    posterUrl: null,
    genres: [],
    expertAgeRec,
  })

  it("badges a « Tous publics » recommendation « TP », never « 0+ »", async () => {
    const member = { id: "m1", name: "Léa", avatarEmoji: "🦊", birthYear: 2018, birthMonth: null, _count: { reactions: 3 } }
    serve({
      "/api/user/family": { familyMembers: [member] },
      "/api/recommendations": {
        familyMember: member,
        recommendations: [rec("a", "Reco tous publics", 0), rec("b", "Reco neuf ans", 9), rec("c", "Reco sans âge", null)],
      },
    })
    render(<FamilyRecommendations />)

    const tpCard = await screen.findByRole("link", { name: /Reco tous publics/ })
    expect(within(tpCard).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco neuf ans/ })).getByText("9+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco sans âge/ })).queryByText(AGE_BADGE)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})
