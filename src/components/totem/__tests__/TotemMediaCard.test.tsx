import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { TotemMediaCard, type TotemCitedMedia } from "../TotemMediaCard"

// The title cards Totem cites in the chat. `recommendedAge` is the catalogue's
// expertAgeRec, so 0 is a REAL rating (« Tous publics »), not a gap: the badge
// reads « TP », never « 0+ » (@/lib/age-label). Only null stays badge-less.

const cited = (id: string, title: string, recommendedAge: number | null): TotemCitedMedia => ({
  id,
  title,
  type: "MOVIE",
  year: null,
  posterUrl: null,
  recommendedAge,
  genres: [],
})

// The link is an empty stretched overlay (aria-label = title); the badge lives
// in its sibling content, so scope to the card.
const cardOf = (title: string) => within(screen.getByRole("link", { name: title }).parentElement!)

describe("TotemMediaCard — age badge", () => {
  it("badges 0 « TP », 13 « 13+ », and leaves null without a badge", () => {
    render(
      <>
        <TotemMediaCard media={cited("a", "Film tous publics", 0)} />
        <TotemMediaCard media={cited("b", "Film treize ans", 13)} />
        <TotemMediaCard media={cited("c", "Film sans âge", null)} />
      </>,
    )

    expect(cardOf("Film tous publics").getByText("TP")).toBeInTheDocument()
    expect(cardOf("Film treize ans").getByText("13+")).toBeInTheDocument()
    expect(cardOf("Film sans âge").queryByText(/^(TP|\d+\+)$/)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})
