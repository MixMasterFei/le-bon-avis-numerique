import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { AssembledCard } from "@/lib/nl-search/assemble"
import { BoardIndex } from "../BoardIndex"

// The « Recherche magique » board. expertAgeRec 0 is a REAL rating (« Tous
// publics »), not a gap — it must read « TP », never « 0+ » or « à confirmer »
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
