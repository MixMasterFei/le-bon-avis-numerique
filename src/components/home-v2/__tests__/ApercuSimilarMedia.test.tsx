import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { SimilarItem } from "@/lib/similar-media"

const similar = vi.hoisted(() => ({ getSimilarMedia: vi.fn() }))
vi.mock("@/lib/similar-media", () => similar)

import { ApercuSimilarMedia } from "../ApercuSimilarMedia"

const item = (id: string, title: string, expertAgeRec: number | null): SimilarItem => ({
  id,
  title,
  type: "MOVIE",
  posterUrl: null,
  expertAgeRec,
  genres: ["Animation"],
  topics: [],
  releaseDate: null,
  score: 1,
})

const props = { mediaId: "movie-1", mediaType: "MOVIE", genres: ["Animation"], topics: [], serifClass: "font-serif" }

// « Titres similaires » on the classic fiche. expertAgeRec 0 is a REAL rating
// (« Tous publics »), not a gap — @/lib/age-label.
describe("ApercuSimilarMedia — age badges", () => {
  it("badges a « Tous publics » suggestion « TP », never a missing badge or « 0+ »", async () => {
    similar.getSimilarMedia.mockResolvedValueOnce([
      item("a", "Film tous publics", 0),
      item("b", "Film dix ans", 10),
      item("c", "Film sans âge", null),
    ])
    render(await ApercuSimilarMedia(props))

    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film dix ans/ })).getByText("10+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film sans âge/ })).queryByText(/^(TP|\d+\+)$/)).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })
})
