import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { EnrichmentPanel } from "../EnrichmentPanel"

// « Recemment enrichis ». The badge used `{item.expertAgeRec && …}`, so a « Tous
// publics » title (0) printed a bare « 0 » instead of a badge. 0 is a REAL
// rating: it reads « TP » (@/lib/age-label). Only null stays badge-less.

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("EnrichmentPanel — recently enriched list", () => {
  it("badges 0 « TP » (no stray « 0 »), 15 « 15+ », and leaves null without a badge", async () => {
    const enriched = (title: string, expertAgeRec: number | null) => ({
      title,
      type: "MOVIE",
      expertAgeRec,
      updatedAt: "2026-11-05T08:00:00.000Z",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stats: { MOVIE: 3 },
          enrichment: { withMetrics: 3, withoutMetrics: 0, withoutAgeRec: 1, percentComplete: 100 },
          recentlyEnriched: [enriched("Film tous publics", 0), enriched("Film quinze ans", 15), enriched("Film sans âge", null)],
        }),
      }),
    )
    render(<EnrichmentPanel />)
    await screen.findByText("Film tous publics")
    // title <span> → icon+title group → the row
    const row = (title: string) => within(screen.getByText(title).parentElement!.parentElement!)

    expect(row("Film tous publics").getByText("TP")).toBeInTheDocument()
    expect(row("Film tous publics").queryByText("0")).toBeNull()
    expect(row("Film quinze ans").getByText("15+")).toBeInTheDocument()
    expect(row("Film sans âge").queryByText(/^(TP|\d+\+)$/)).toBeNull()
  })
})
