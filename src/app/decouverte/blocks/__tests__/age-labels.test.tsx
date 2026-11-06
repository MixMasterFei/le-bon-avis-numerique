import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { AssembledCard } from "@/lib/nl-search/assemble"
import type { BlockMeta, HeroData } from "@/lib/nl-search/resolve-blocks"
import { buildQuickAnswer } from "@/lib/quick-answer"
import { BoardBallot } from "@/app/tableau/[id]/BoardBallot"
import { BoardIndex } from "../BoardIndex"
import { GridBlock, toRedesignCard } from "../BoardSections"
import { HeroMatch } from "../HeroMatch"

// The « Recherche magique » board, end to end: index, sections, une, ballot.
// expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap — it must read
// « TP » / « Tous publics », never « 0+ », « Dès 0 ans » or « à confirmer »
// (@/lib/age-label). Only null is an unknown age.

const card = (id: string, title: string, expertAgeRec: number | null): AssembledCard => ({
  id,
  type: "MOVIE",
  title,
  posterUrl: null,
  expertAgeRec,
  genres: ["Animation"],
  contentMetrics: null,
})

const tp = card("tp", "Film tous publics", 0)
const ten = card("ten", "Film dix ans", 10)
const unknown = card("unknown", "Film sans âge", null)

describe("BoardIndex — « L'index »", () => {
  it("badges a « Tous publics » title « TP », keeps « 10+ » and « à confirmer »", () => {
    render(<BoardIndex folio="04" items={[tp, ten, unknown, card("six", "Film six ans", 6)]} />)

    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film dix ans/ })).getByText("10+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film sans âge/ })).getByText("à confirmer")).toBeInTheDocument()
    expect(screen.queryByText("0+")).toBeNull()
  })
})

describe("GridBlock — numbered variant", () => {
  const meta: BlockMeta = { eyebrow: null, title: "Le classement", em: null, lead: null, variant: "numbered" }

  it("reads « Tous publics » for 0, « Dès 10 ans » for 10, « Âge à confirmer » for null", () => {
    render(<GridBlock meta={meta} items={[tp, ten, unknown].map(toRedesignCard)} alt={false} />)

    expect(within(screen.getByRole("link", { name: /Film tous publics/ })).getByText(/^Tous publics/)).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film dix ans/ })).getByText(/^Dès 10 ans/)).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Film sans âge/ })).getByText(/^Âge à confirmer/)).toBeInTheDocument()
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
  })
})

describe("HeroMatch — la une", () => {
  const meta: BlockMeta = { eyebrow: null, title: null, em: null, lead: null, variant: "grid" }
  const zero = { violence: 0, sexNudity: 0, language: 0, consumerism: 0, substanceUse: 0, positiveMessages: 0, roleModels: 0 }

  // Built with the real quick answer: its phrase is what the pill shows, and it
  // still words a 0 « avec un âge à confirmer ».
  function heroFor(c: AssembledCard): HeroData {
    return {
      card: c,
      matureArt: false,
      backdropUrl: null,
      screenshots: [],
      synopsis: "Une histoire à partager en famille.",
      voiceLine: null,
      quickAnswer: buildQuickAnswer({ title: c.title, type: c.type, expertAgeRec: c.expertAgeRec, contentMetrics: zero }),
      ageRationale: null,
      whatParentsNeedToKnow: [],
      toneTags: [],
      hideContentAnalysis: false,
      officialRating: null,
      director: null,
      releaseDate: null,
      platforms: [],
    }
  }

  const verdict = () => within(screen.getByText("Le verdict").closest("aside")!)

  it("gives a « Tous publics » hero its verdict and pill, never « Dès 0 ans » or « à confirmer »", () => {
    render(<HeroMatch meta={meta} hero={heroFor(tp)} />)

    expect(verdict().getByText("Tous publics")).toBeInTheDocument()
    // The pill on the cover + the verdict card.
    expect(screen.getAllByText("Tous publics")).toHaveLength(2)
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
    expect(screen.queryByText(/à confirmer/)).toBeNull()
  })

  it("keeps the quick-answer pill and « Dès 10 ans » verdict for a rated title", () => {
    render(<HeroMatch meta={meta} hero={heroFor(ten)} />)

    expect(screen.getByText("à partir de 10 ans")).toBeInTheDocument()
    expect(verdict().getByText("Dès 10 ans")).toBeInTheDocument()
  })

  it("shows no pill and « Âge à confirmer » when the age is unknown", () => {
    render(<HeroMatch meta={meta} hero={heroFor(unknown)} />)

    expect(verdict().getByText("Âge à confirmer")).toBeInTheDocument()
    expect(screen.queryByText("avec un âge à confirmer")).toBeNull()
  })
})

describe("BoardBallot — « Alors, on regarde quoi ? »", () => {
  it("labels a « Tous publics » candidate « Tous publics », never « Dès 0 ans »", () => {
    render(
      <BoardBallot
        boardId="board-1"
        budget={3}
        items={[tp, ten, unknown].map(({ id, title, posterUrl, expertAgeRec }) => ({ id, title, posterUrl, expertAgeRec }))}
        initialTallies={[]}
        initialMyVotes={{}}
        initialMyName={null}
        initialVoterCount={0}
      />,
    )
    const row = (title: string) => within(screen.getByText(title).closest("li")!)

    expect(row("Film tous publics").getByText("Tous publics")).toBeInTheDocument()
    expect(row("Film dix ans").getByText("Dès 10 ans")).toBeInTheDocument()
    expect(row("Film sans âge").getByText("Âge à confirmer")).toBeInTheDocument()
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
  })
})
