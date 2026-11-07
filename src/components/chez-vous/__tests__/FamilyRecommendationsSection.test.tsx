import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, within } from "@testing-library/react"

// next-auth's useSession hands back the SAME session object from one render to
// the next (it lives in SessionProvider's context). The previous mock built a
// new `user` object on every call, and the section keys its family fetch on
// `session?.user`: every render refetched /api/user/family and every response
// re-rendered — about 200 requests per 200 ms while mounted. One of them could
// fire after afterEach had restored the real fetch, where a relative URL is an
// unhandled rejection that made a full `vitest run` exit 1 with every test green.
const { session } = vi.hoisted(() => ({
  session: { data: { user: { id: "user-1" } }, status: "authenticated" as const },
}))

vi.mock("next-auth/react", () => ({ useSession: () => session }))
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
  // Unmount BEFORE restoring fetch. Vitest runs afterEach hooks in reverse
  // registration order, so Testing Library's automatic cleanup would only
  // unmount after the real fetch was back.
  cleanup()
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
    const fetchMock = vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix))
      return { ok: true, json: async () => (key ? routes[key] : {}) }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<FamilyRecommendationsSection />)

    const tpCard = await screen.findByRole("link", { name: /Reco tous publics/ })
    expect(within(tpCard).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco onze ans/ })).getByText("11+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Reco sans âge/ })).queryByText(/^(TP|\d+\+)$/)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()

    // One request per resource, and nothing left running: a refetch loop would
    // have piled up dozens of calls by now.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/user/family",
      "/api/recommendations?familyMemberId=m1",
    ])
  })
})
