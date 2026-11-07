import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const votes = vi.hoisted(() => ({ useTriggerVotes: vi.fn() }))
vi.mock("@/components/media/FicheDataContext", () => votes)
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }))
vi.mock("next/navigation", () => ({ usePathname: () => "/media/movie:x" }))
vi.mock("@/components/media/TriggerChip", () => ({
  TriggerChip: ({ category }: { category: string }) => <span>{category}</span>,
}))

import { DashboardSensitiveWarnings } from "../DashboardSensitiveWarnings"
import { aiWarningsState } from "@/lib/sensitive-warnings"

// F02 — « Ce qui peut marquer » on the V3 fiche. An empty list used to read
// « Aucun point signalé pour l'instant » whatever it meant; on « Amélie et la
// métaphysique des tubes » that sat over two near-drownings and a bereavement.

function renderCard(ai: ReturnType<typeof aiWarningsState>, community: Record<string, { total: number }> = {}) {
  votes.useTriggerVotes.mockReturnValue({ data: { categories: community }, loading: false })
  render(<DashboardSensitiveWarnings mediaId="media-1" aiItems={ai.items} aiState={ai.state} />)
}

describe("DashboardSensitiveWarnings — what an empty list says", () => {
  it("says « pas encore de données » when nothing was ever computed", () => {
    renderCard(aiWarningsState({ warnings: [], assessedAt: null, confidence: null }))

    expect(screen.getByText("Pas encore de données sur les moments sensibles")).toBeInTheDocument()
    expect(screen.queryByText(/Aucun point signalé/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Ce qui peut marquer/ }))
    expect(screen.getByText(/Leur absence ne veut pas dire qu'il n'y en a pas/)).toBeInTheDocument()
  })

  it("hedges a confident « nothing found » (the Amélie case) — never an affirmative no-concern", () => {
    renderCard(aiWarningsState({ warnings: [], assessedAt: "2026-08-04T06:29:35.016Z", confidence: 0.72 }))

    expect(screen.getByText("Rien de relevé par l'analyse automatique · ce n'est pas une garantie")).toBeInTheDocument()
    expect(screen.queryByText(/Aucun point signalé/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Ce qui peut marquer/ }))
    expect(screen.getByText(/elle ne voit pas chaque scène/)).toBeInTheDocument()
  })

  it("counts and lists the flags when there are some — AI or community", () => {
    renderCard(aiWarningsState({ warnings: ["Noyade", "Guerre"], assessedAt: "2026-08-04", confidence: 0.8 }))
    expect(screen.getByText("2 points de vigilance · afficher (peut divulgâcher)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Ce qui peut marquer/ }))
    expect(screen.getByText("Noyade")).toBeInTheDocument()
  })

  it("still counts parents' flags when the analysis has no data", () => {
    renderCard(aiWarningsState({ warnings: [], assessedAt: null, confidence: null }), { "Thèmes de mort ou de deuil": { total: 3 } })
    expect(screen.getByText("1 point de vigilance · afficher (peut divulgâcher)")).toBeInTheDocument()
  })
})
