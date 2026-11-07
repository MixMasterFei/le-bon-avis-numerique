import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { GameRow } from "../gamesAgeData"

const data = vi.hoisted(() => ({ fetchTopGameRows: vi.fn() }))
vi.mock("../gamesAgeData", () => data)
vi.mock("@/components/ui/SafeImage", () => ({ SafeImage: () => null }))

import GamesAgePillarPage from "../page"

// The « Jeux vidéo : à partir de quel âge ? » pillar. expertAgeRec 0 is a REAL
// rating (« Tous publics »), not a gap: the chip reads « Tous publics », never
// « Dès 0 ans » (@/lib/age-label).

const row = (key: string, name: string, expertAgeRec: number | null): GameRow => ({
  seed: { key, name, aliases: [key], parentNote: "Très demandé à la maison." },
  id: `game-${key}`,
  title: name,
  posterUrl: null,
  expertAgeRec,
  officialRating: null,
  contentMetrics: null,
})

describe("/jeux/quel-age — age chip", () => {
  it("reads « Tous publics » for 0, keeps « Dès 12 ans », and shows no chip for an unknown age", async () => {
    data.fetchTopGameRows.mockResolvedValue([
      row("tp", "Jeu tous publics", 0),
      row("douze", "Jeu douze ans", 12),
      row("inconnu", "Jeu sans âge", null),
    ])
    render(await GamesAgePillarPage())

    expect(within(screen.getByRole("link", { name: /Jeu tous publics/ })).getByText("Tous publics")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Jeu douze ans/ })).getByText("Dès 12 ans")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Jeu sans âge/ })).queryByText(/^(Tous publics|Dès \d+ ans)$/)).toBeNull()
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
  })
})
