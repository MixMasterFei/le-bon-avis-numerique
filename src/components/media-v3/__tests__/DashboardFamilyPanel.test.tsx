import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { FamilyFitMember } from "@/components/media/FicheDataContext"

const fit = vi.hoisted(() => ({ useFamilyFitData: vi.fn() }))
vi.mock("@/components/media/FicheDataContext", () => fit)
vi.mock("@/components/media/FamilyFitConversionFlow", () => ({
  FamilyFitQuickSetup: () => null,
  FamilyFitSignIn: () => null,
}))

import { DashboardFamilyPanel } from "../DashboardFamilyPanel"

// « Pour ma famille » on the V3 fiche. The summary line names the recommended
// age; expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap: it reads
// « recommandé pour tous publics », never « recommandé dès 0 ans » (@/lib/age-label).

const member = (id: string, name: string, age: number, level: FamilyFitMember["level"]): FamilyFitMember => ({
  id,
  name,
  avatarEmoji: "🦊",
  age,
  score: 80,
  level,
  reason: "Une raison.",
})

function renderPanel(recommendedAge: number | null, members: FamilyFitMember[]) {
  fit.useFamilyFitData.mockReturnValue({ data: { status: "ok", members }, loading: false, refetch: () => {} })
  render(<DashboardFamilyPanel mediaId="media-1" recommendedAge={recommendedAge} />)
  return screen.getByText(/Convient à/)
}

describe("DashboardFamilyPanel — summary line", () => {
  it("says « recommandé pour tous publics » for 0, never « dès 0 ans »", () => {
    const summary = renderPanel(0, [member("a", "Léa", 8, "excellent"), member("b", "Tom", 4, "good")])

    expect(summary).toHaveTextContent("Convient à 2 de vos 2 membres — recommandé pour tous publics.")
    expect(screen.queryByText(/dès 0 ans/)).toBeNull()
  })

  it("keeps « recommandé dès 10 ans » with its « un peu tôt » note", () => {
    const rated = renderPanel(10, [member("a", "Léa", 12, "excellent"), member("b", "Tom", 5, "moderate")])
    expect(rated).toHaveTextContent("Convient à 1 de vos 2 membres — recommandé dès 10 ans, encore un peu tôt pour Tom.")
  })

  it("leaves the age clause out when the age is unknown", () => {
    const unknown = renderPanel(null, [member("a", "Léa", 8, "excellent")])
    expect(unknown).toHaveTextContent("Convient à 1 de vos 1 membre.")
  })
})
