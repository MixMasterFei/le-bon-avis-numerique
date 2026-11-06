import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("../AgeVoteButton", () => ({ AgeVoteButton: () => null }))

import { MediaHeroEditable } from "../MediaHeroEditable"

const film = {
  mediaId: "movie-1",
  type: "MOVIE" as const,
  officialRating: "TOUS_PUBLICS",
  title: "Un film",
  synopsisFr: "Un synopsis.",
  expertAgeRec: 8,
  genres: ["Animation"],
  director: null,
  duration: 95,
  releaseDate: "2017-11-29",
  originalTitle: null,
}

describe("MediaHeroEditable — age block", () => {
  it("links « Comment lire cet âge ? » to the blog article when it is live", () => {
    render(<MediaHeroEditable {...film} ageGuideHref="/blog/bon-age-film-enfant" />)
    expect(screen.getByText("Dès 8 ans")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Comment lire cet âge ?" })).toHaveAttribute("href", "/blog/bon-age-film-enfant")
  })

  it("shows no link while the article isn't published", () => {
    render(<MediaHeroEditable {...film} />)
    expect(screen.getByText("Dès 8 ans")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Comment lire cet âge ?" })).toBeNull()
  })
})
