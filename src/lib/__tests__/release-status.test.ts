import { describe, it, expect } from "vitest"
import {
  contentAnalysisHiddenReason,
  isReleasedAwaitingAnalysis,
  isUnreleased,
  isUnreleasedStatus,
  shouldHideContentAnalysis,
  UNRELEASED_TMDB_STATUSES,
} from "../release-status"
import { pendingAnalysisText } from "../quick-answer"

const DAY = 864e5
const future = new Date(Date.now() + 30 * DAY)
const past = new Date(Date.now() - 30 * DAY)

describe("isUnreleased", () => {
  it("false for null / undefined", () => {
    expect(isUnreleased(null)).toBe(false)
    expect(isUnreleased(undefined)).toBe(false)
  })
  it("true for a future date, false for a past date", () => {
    expect(isUnreleased(future)).toBe(true)
    expect(isUnreleased(past)).toBe(false)
  })
  it("accepts ISO strings", () => {
    expect(isUnreleased(future.toISOString())).toBe(true)
    expect(isUnreleased(past.toISOString())).toBe(false)
  })
  it("false for an invalid date string", () => {
    expect(isUnreleased("not-a-date")).toBe(false)
  })
})

describe("isUnreleasedStatus", () => {
  it("true for every pre-release TMDB status", () => {
    for (const s of UNRELEASED_TMDB_STATUSES) expect(isUnreleasedStatus(s)).toBe(true)
  })
  it("false for Released, aired TV statuses, and null", () => {
    expect(isUnreleasedStatus("Released")).toBe(false)
    expect(isUnreleasedStatus("Returning Series")).toBe(false)
    expect(isUnreleasedStatus("Ended")).toBe(false)
    expect(isUnreleasedStatus("Canceled")).toBe(false)
    expect(isUnreleasedStatus(null)).toBe(false)
    expect(isUnreleasedStatus(undefined)).toBe(false)
  })
})

describe("shouldHideContentAnalysis", () => {
  it("hides a future-dated title", () => {
    expect(shouldHideContentAnalysis({ releaseDate: future })).toBe(true)
  })
  it("hides a provisional fiche (explicit flag)", () => {
    expect(shouldHideContentAnalysis({ isProvisional: true })).toBe(true)
  })
  it("hides a provisional fiche (derived from !isEnriched + age)", () => {
    expect(shouldHideContentAnalysis({ isEnriched: false, expertAgeRec: 8 })).toBe(true)
  })
  it("hides a null-dated enriched title with a pre-release status (the Indestructibles 3 case)", () => {
    expect(
      shouldHideContentAnalysis({
        releaseDate: null,
        isEnriched: true,
        expertAgeRec: 7,
        releaseStatus: "Planned",
      }),
    ).toBe(true)
  })
  it("shows a released, enriched film", () => {
    expect(
      shouldHideContentAnalysis({
        releaseDate: past,
        isEnriched: true,
        expertAgeRec: 12,
        releaseStatus: "Released",
      }),
    ).toBe(false)
  })
  it("shows an aired series (status 'Returning Series', not 'Released')", () => {
    expect(
      shouldHideContentAnalysis({
        releaseDate: past,
        isEnriched: true,
        expertAgeRec: 10,
        releaseStatus: "Returning Series",
      }),
    ).toBe(false)
  })
  it("shows an old catalog item (null date, enriched, unknown status)", () => {
    expect(
      shouldHideContentAnalysis({
        releaseDate: null,
        isEnriched: true,
        expertAgeRec: 12,
        releaseStatus: null,
      }),
    ).toBe(false)
  })
})

/**
 * Regression: L'Odyssée (imported 2025-12-23, released 2026-07-15) spent its
 * opening week telling visitors the analysis would be published "après la
 * sortie" — on a film that was already in cinemas, carrying ~79% of all site
 * traffic. The gate was right to hide the analysis; the WORDING was wrong.
 */
describe("contentAnalysisHiddenReason", () => {
  it("'unreleased' for a future-dated title", () => {
    expect(contentAnalysisHiddenReason({ releaseDate: future })).toBe("unreleased")
  })

  it("'unreleased' wins over provisional for a not-yet-out title", () => {
    expect(
      contentAnalysisHiddenReason({ releaseDate: future, isEnriched: false, expertAgeRec: 12 }),
    ).toBe("unreleased")
  })

  it("'unreleased' for a null-dated title with a pre-release TMDB status", () => {
    expect(
      contentAnalysisHiddenReason({ releaseDate: null, releaseStatus: "Post Production" }),
    ).toBe("unreleased")
  })

  it("'awaiting-analysis' for a RELEASED but unenriched title (the L'Odyssée case)", () => {
    expect(
      contentAnalysisHiddenReason({
        releaseDate: past,
        isEnriched: false,
        expertAgeRec: 12,
        releaseStatus: null,
      }),
    ).toBe("awaiting-analysis")
  })

  it("null once the released title is enriched", () => {
    expect(
      contentAnalysisHiddenReason({
        releaseDate: past,
        isEnriched: true,
        expertAgeRec: 12,
        releaseStatus: "Released",
      }),
    ).toBeNull()
  })

  it("stays consistent with shouldHideContentAnalysis for every shape", () => {
    const shapes = [
      { releaseDate: future },
      { releaseDate: past, isEnriched: false, expertAgeRec: 12 },
      { releaseDate: past, isEnriched: true, expertAgeRec: 12, releaseStatus: "Released" },
      { releaseDate: null, releaseStatus: "Planned" },
      { releaseDate: null, isEnriched: true, expertAgeRec: 8, releaseStatus: null },
      { isProvisional: true },
    ]
    for (const s of shapes) {
      expect(shouldHideContentAnalysis(s)).toBe(contentAnalysisHiddenReason(s) !== null)
    }
  })
})

describe("isReleasedAwaitingAnalysis", () => {
  it("true only for out-but-unanalysed", () => {
    expect(
      isReleasedAwaitingAnalysis({ releaseDate: past, isEnriched: false, expertAgeRec: 12 }),
    ).toBe(true)
    expect(isReleasedAwaitingAnalysis({ releaseDate: future })).toBe(false)
    expect(
      isReleasedAwaitingAnalysis({ releaseDate: past, isEnriched: true, expertAgeRec: 12 }),
    ).toBe(false)
  })
})

describe("pendingAnalysisText", () => {
  it("only mentions the release for a genuinely unreleased title", () => {
    expect(pendingAnalysisText("unreleased")).toMatch(/sortie/i)
  })

  it("NEVER defers to the release date for an already-released title", () => {
    // The exact bug: "sera publiée après sa sortie" on a film in cinemas.
    expect(pendingAnalysisText("awaiting-analysis")).not.toMatch(/après (sa|la) sortie/i)
  })

  it("falls back to neutral wording when the reason is unknown", () => {
    // Fail-safe: a caller that forgets the reason must not assert a falsehood.
    for (const v of [null, undefined]) {
      expect(pendingAnalysisText(v)).not.toMatch(/après (sa|la) sortie/i)
    }
  })
})
