import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { OfficialRatingBadge } from "../AgeBadge"
import { FAMILY_FACTS } from "@/lib/family-facts"

// The CSA became the Arcom on 1 January 2022, and cinema classification is the
// CNC's: no rendered text may still credit the CSA with a classification.
describe("official classification wording", () => {
  it("film tooltip names the CNC (cinema) and the Arcom (TV), never the CSA", () => {
    render(<OfficialRatingBadge rating="CSA_12" type="MOVIE" />)
    const title = screen.getByText("-12").getAttribute("title") ?? ""
    expect(title).toContain("CNC")
    expect(title).toContain("Arcom")
    expect(title).not.toContain("CSA")
  })

  it("series tooltip names the Arcom signalétique, never the CSA", () => {
    render(<OfficialRatingBadge rating="CSA_10" type="TV" />)
    const title = screen.getByText("-10").getAttribute("title") ?? ""
    expect(title).toContain("Arcom")
    expect(title).not.toContain("CSA")
  })

  it("the « fact of the week » lists cinema visas without -10 (a TV-only category)", () => {
    const cinema = FAMILY_FACTS.find((f) => f.label.includes("visas du CNC"))
    expect(cinema?.stat).toBe("TP, -12, -16, -18")
  })
})
