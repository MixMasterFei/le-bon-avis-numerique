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

describe("GameInfoCard — in-game purchases are never denied", () => {
  it("says « non renseigné », not « Pas d'achats », when nothing flags purchases (the Minecraft case)", () => {
    render(<GameInfoCard consumerism={1} officialRating="PEGI_7" pegiDescriptors={[]} expertAgeRec={7} />)
    expect(screen.queryByText(/Pas d'achats/)).toBeNull()
    expect(screen.getByText(/Non renseigné · à vérifier/)).toBeInTheDocument()
  })

  it("credits PEGI's own « Achats intégrés » pictogram, even with a low analysis score", () => {
    render(<GameInfoCard consumerism={0} officialRating="PEGI_3" pegiDescriptors={["Achats intégrés"]} expertAgeRec={3} />)
    expect(screen.getByText(/Oui · signalé par PEGI/)).toBeInTheDocument()
  })

  it("says the analysis flagged purchases when the consumerism score is high", () => {
    render(<GameInfoCard consumerism={4} officialRating="PEGI_12" pegiDescriptors={[]} expertAgeRec={12} />)
    expect(screen.getByText(/Signalé par notre analyse/)).toBeInTheDocument()
  })
})
