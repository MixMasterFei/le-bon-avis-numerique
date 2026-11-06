import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { buildAgeRationale } from "@/lib/age-rationale"

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// Stub (it fetches on mount) that still leaves a trace, so a test can tell
// whether the verdict strip offers the vote.
vi.mock("../AgeVoteButton", () => ({
  AgeVoteButton: ({ mediaId }: { mediaId: string }) => <div data-testid="age-vote" data-media-id={mediaId} />,
}))

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

const calmMetrics = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  consumerism: 0,
  substanceUse: 0,
  positiveMessages: 4,
  roleModels: 4,
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

  it("badges a rated film « 8+ » on the « Pourquoi cet âge ? » trigger", () => {
    const ageRationale = buildAgeRationale({ ...film, contentMetrics: calmMetrics })
    render(<MediaHeroEditable {...film} ageRationale={ageRationale} />)
    expect(screen.getByRole("button", { name: /voir le détail/ })).toHaveTextContent("8+")
  })
})

// expertAgeRec 0 is a REAL rating (CSA TP / CNC U), not a gap — @/lib/age-label.
describe("MediaHeroEditable — « Tous publics » (expertAgeRec: 0)", () => {
  const tp = { ...film, expertAgeRec: 0 }

  it("shows the verdict strip as « TP » / « Tous publics », never « 0+ » / « Dès 0 ans »", () => {
    render(<MediaHeroEditable {...tp} />)
    expect(screen.getByText("Notre recommandation")).toBeInTheDocument()
    expect(screen.getByText("TP")).toBeInTheDocument()
    expect(screen.getByText("Tous publics")).toBeInTheDocument()
    expect(screen.queryByText("0+")).toBeNull()
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
  })

  it("keeps the age vote and the « Comment lire cet âge ? » link on a TP film", () => {
    render(<MediaHeroEditable {...tp} ageGuideHref="/blog/bon-age-film-enfant" />)
    expect(screen.getByTestId("age-vote")).toHaveAttribute("data-media-id", "movie-1")
    expect(screen.getByRole("link", { name: "Comment lire cet âge ?" })).toHaveAttribute("href", "/blog/bon-age-film-enfant")
  })

  it("has no « Pourquoi cet âge ? » rationale to show, so the TP badge stays a plain bubble", () => {
    const ageRationale = buildAgeRationale({ ...tp, contentMetrics: calmMetrics })
    expect(ageRationale.show).toBe(false)
    render(<MediaHeroEditable {...tp} ageRationale={ageRationale} />)
    expect(screen.getByText("TP")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /voir le détail/ })).toBeNull()
  })

  it("still shows no verdict when the age is unknown — null is not 0", () => {
    render(<MediaHeroEditable {...film} expertAgeRec={null} />)
    expect(screen.queryByText("Notre recommandation")).toBeNull()
    expect(screen.queryByText("TP")).toBeNull()
    expect(screen.queryByTestId("age-vote")).toBeNull()
  })
})
