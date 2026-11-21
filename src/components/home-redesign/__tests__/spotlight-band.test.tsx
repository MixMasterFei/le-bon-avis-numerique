import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

vi.mock("../parts", () => ({
  CardRailSection: ({ items, lead }: { items: { id: string; title: string; expertAgeRec?: number | null; provisional?: boolean }[]; lead?: string }) => (
    <div>
      <p>{lead}</p>
      {items.map((item) => (
        <span key={item.id} data-age={item.expertAgeRec ?? ""} data-provisional={item.provisional ? "1" : "0"}>
          {item.title}
        </span>
      ))}
    </div>
  ),
  Em: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

import { SpotlightBand } from "../SpotlightBand"
import type { SpotlightItem } from "@/lib/homepage-spotlight"

function item(id: string, title: string, type: SpotlightItem["type"], age: number, provisional = false): SpotlightItem {
  return {
    id,
    type,
    title,
    posterUrl: `https://img/${id}.jpg`,
    expertAgeRec: age,
    isEnriched: !provisional,
    isProvisional: provisional,
    genres: [],
    contentMetrics: null,
    origin: "fallback",
  }
}

const items = [
  item("hunger", "Hunger Games: Lever de soleil sur la moisson", "MOVIE", 14),
  item("visionquest", "VisionQuest", "TV", 12),
  item("gta6", "Grand Theft Auto VI", "GAME", 18),
  item("asterix", "Astérix : Le Royaume de Nubie", "MOVIE", 6, true),
]

afterEach(cleanup)

describe("SpotlightBand", () => {
  it("shows an 18+ title with its age — the band is informational, never age-capped", () => {
    render(<SpotlightBand items={items} />)
    expect(screen.getByText("Grand Theft Auto VI")).toHaveAttribute("data-age", "18")
    expect(screen.getByText(/pas une sélection pour l'âge choisi/)).toBeInTheDocument()
  })

  it("passes the provisional flag through so the card badges « à confirmer »", () => {
    render(<SpotlightBand items={items} />)
    expect(screen.getByText("Astérix : Le Royaume de Nubie")).toHaveAttribute("data-provisional", "1")
  })

  it("hides itself when there are too few titles to make a band", () => {
    const { container } = render(<SpotlightBand items={items.slice(0, 2)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
