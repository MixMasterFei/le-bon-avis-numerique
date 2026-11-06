import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { GameInfoCard } from "../GameInfoCard"

describe("GameInfoCard", () => {
  it("shows a catalogue co-op game (French topics) as multiplayer, not « Se joue seul »", () => {
    render(
      <GameInfoCard
        genres={["Simulation", "Indé"]}
        topics={["Solo", "Multijoueur", "Coopératif", "Écran partagé", "Party game", "Cuisine"]}
        officialRating="PEGI_3"
        pegiDescriptors={[]}
        expertAgeRec={7}
      />,
    )
    expect(screen.getByText("Multijoueur")).toBeInTheDocument()
    expect(screen.queryByText("Se joue seul")).toBeNull()
    expect(screen.queryByText("Solo uniquement")).toBeNull()
  })
})

// The Totem age written under the PEGI badge when the two differ. expertAgeRec
// 0 is a REAL rating (« Tous publics »), not a gap: « Totem recommande pour tous
// publics », never « dès 0 ans » (@/lib/age-label).
describe("GameInfoCard — Totem age next to PEGI", () => {
  it("writes a « Tous publics » Totem age « pour tous publics », never « dès 0 ans »", () => {
    render(<GameInfoCard officialRating="PEGI_3" pegiDescriptors={[]} expertAgeRec={0} />)

    expect(screen.getByText(/Totem recommande/)).toHaveTextContent("Totem recommande pour tous publics")
    expect(screen.queryByText(/dès 0 ans/)).toBeNull()
  })

  it("keeps « dès 7 ans », and says nothing when Totem agrees with PEGI or has no age", () => {
    const { unmount } = render(<GameInfoCard officialRating="PEGI_3" pegiDescriptors={[]} expertAgeRec={7} />)
    expect(screen.getByText(/Totem recommande/)).toHaveTextContent("Totem recommande dès 7 ans")
    unmount()

    const { unmount: unmountSame } = render(<GameInfoCard officialRating="PEGI_7" pegiDescriptors={[]} expertAgeRec={7} />)
    expect(screen.queryByText(/Totem recommande/)).toBeNull()
    unmountSame()

    render(<GameInfoCard officialRating="PEGI_7" pegiDescriptors={[]} expertAgeRec={null} />)
    expect(screen.queryByText(/Totem recommande/)).toBeNull()
  })
})
