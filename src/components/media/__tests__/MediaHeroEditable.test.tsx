import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
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

  // A TP verdict is explained like any other age (it used to be treated as
  // « no age » by buildAgeRationale, so the badge had nothing to open).
  it("explains a TP verdict too: the « TP » badge opens « Pourquoi tous publics ? »", () => {
    const ageRationale = buildAgeRationale({ ...tp, contentMetrics: calmMetrics })
    expect(ageRationale.show).toBe(true)
    render(<MediaHeroEditable {...tp} ageRationale={ageRationale} />)
    expect(screen.getByRole("button", { name: /Pourquoi tous publics \? — voir le détail/ })).toHaveTextContent("TP")
  })

  it("still shows no verdict when the age is unknown — null is not 0", () => {
    render(<MediaHeroEditable {...film} expertAgeRec={null} />)
    expect(screen.queryByText("Notre recommandation")).toBeNull()
    expect(screen.queryByText("TP")).toBeNull()
    expect(screen.queryByTestId("age-vote")).toBeNull()
  })
})

// A review's age is optional (ReviewModal starts at none, the API stores null)
// and page.tsx hands the hero `ageSuggestion: r.ageSuggestion ?? 0`. On a
// review, 0 therefore means « no age suggested » — NOT « Tous publics ».
describe("MediaHeroEditable — community « Parents » / « Enfants » bubbles", () => {
  const NO_AGE = 0
  const review = (role: "PARENT" | "KID" | "EDUCATOR", ageSuggestion: number) => ({ role, ageSuggestion })

  // A bubble = the age disc + its caption column (« Parents » over « 2 avis »).
  const bubble = (label: "Parents" | "Enfants") => {
    const el = screen.getByText(label).parentElement?.parentElement
    if (!el) throw new Error(`no « ${label} » bubble`)
    return el
  }

  it("averages only the reviews that suggest an age — a missing one does not count as 0", () => {
    render(
      <MediaHeroEditable
        {...film}
        reviews={[
          review("PARENT", 10),
          review("PARENT", NO_AGE),
          review("KID", 6),
          review("KID", NO_AGE),
          review("KID", 12),
        ]}
      />
    )
    expect(within(bubble("Parents")).getByText("10+")).toBeInTheDocument() // not (10 + 0) / 2 = « 5+ »
    expect(within(bubble("Enfants")).getByText("9+")).toBeInTheDocument() // not (6 + 0 + 12) / 3 = « 6+ »
  })

  it("gives no bubble to a role whose reviews suggest no age", () => {
    render(
      <MediaHeroEditable
        {...film}
        reviews={[review("PARENT", 12), review("KID", NO_AGE), review("KID", NO_AGE)]}
      />
    )
    expect(within(bubble("Parents")).getByText("12+")).toBeInTheDocument()
    expect(screen.queryByText("Enfants")).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })

  it("shows no bubble at all when no review suggests an age — never « 0+ », never « TP »", () => {
    render(<MediaHeroEditable {...film} reviews={[review("PARENT", NO_AGE), review("KID", NO_AGE)]} />)
    expect(screen.getByText("Dès 8 ans")).toBeInTheDocument() // the expert verdict is untouched
    expect(screen.queryByText("Parents")).toBeNull()
    expect(screen.queryByText("Enfants")).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
    expect(screen.queryByText("TP")).toBeNull()
  })

  it("renders no age block when neither the expert nor any review gives an age", () => {
    render(
      <MediaHeroEditable
        {...film}
        expertAgeRec={null}
        reviews={[review("PARENT", NO_AGE), review("KID", NO_AGE)]}
      />
    )
    expect(screen.queryByText("Notre recommandation")).toBeNull()
    expect(screen.queryByText("Parents")).toBeNull()
    expect(screen.queryByText("Enfants")).toBeNull()
    expect(screen.queryByText("0+")).toBeNull()
  })

  it("keeps a TP film's own « TP » verdict, without a community « TP » nobody gave", () => {
    render(
      <MediaHeroEditable
        {...film}
        expertAgeRec={0}
        reviews={[review("PARENT", NO_AGE), review("KID", NO_AGE)]}
      />
    )
    expect(screen.getAllByText("TP")).toHaveLength(1)
    expect(screen.queryByText("Parents")).toBeNull()
    expect(screen.queryByText("Enfants")).toBeNull()
  })

  it("counts in each caption only the reviews behind its own average", () => {
    render(
      <MediaHeroEditable
        {...film}
        reviews={[
          review("PARENT", 10),
          review("PARENT", 14),
          review("PARENT", NO_AGE),
          review("KID", 9),
          review("KID", NO_AGE),
          review("EDUCATOR", 16),
        ]}
      />
    )
    // « Parents » used to count every review on the fiche (here « 6 avis »),
    // kids, educators and age-less ones included.
    expect(within(bubble("Parents")).getByText("12+")).toBeInTheDocument()
    expect(within(bubble("Parents")).getByText("2 avis")).toBeInTheDocument()
    expect(within(bubble("Enfants")).getByText("9+")).toBeInTheDocument()
    expect(within(bubble("Enfants")).getByText("1 avis")).toBeInTheDocument()
  })
})
