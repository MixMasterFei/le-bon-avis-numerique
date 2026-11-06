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
