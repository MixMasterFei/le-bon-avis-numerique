import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, status: "authenticated" }),
}))
vi.mock("@/components/ui/MemberAvatar", () => ({ MemberAvatar: () => null }))

import { FamilyRecommendationsSection } from "../FamilyRecommendationsSection"

// /profil « Recommandations personnalisées ». expertAgeRec 0 is a REAL rating
// (« Tous publics »), not a gap: the badge reads « TP », never « 0+ »
// (@/lib/age-label). Only null may stay badge-less.

const rec = (id: string, title: string, expertAgeRec: number | null) => ({
  id,
  title,
  type: "MOVIE",
  posterUrl: null,
  genres: [],
  expertAgeRec,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FamilyRecommendationsSection — age badges", () => {
  it("badges a « Tous publics » recommendation « TP », never « 0+ »", async () => {
    const member = { id: "m1", name: "Léa", avatarEmoji: "🦊", birthYear: 2018, birthMonth: null, _count: { reactions: 3 } }
    const routes: Record<string, unknown> = {
      "/api/user/family": { familyMembers: [member] },
      "/api/recommendations": {
        familyMember: member,
        recommendations: [rec("a", "Reco tous publics", 0), rec("b", "Reco onze ans", 11), rec("c", "Reco sans âge", null)],
      },
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix))
        return { ok: true, json: async () => (key ? routes[key] : {}) }
      }),
    )
    render(<FamilyRecommendationsSection />)

    const tpCard = await screen.findByRole("link", { name: /Reco tous publics/ })
    expect(within(tpCard).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco onze ans/ })).getByText("11+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco sans âge/ })).queryByText(/^(TP|\d+\+)$/)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})
