import { describe, it, expect } from "vitest"
import {
  isUnreleased,
  isUnreleasedStatus,
  shouldHideContentAnalysis,
  UNRELEASED_TMDB_STATUSES,
  UNRELEASED_IGDB_STATUSES,
} from "../release-status"
import { IGDB_UNRELEASED_STATUSES } from "../igdb"

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

describe("isUnreleasedStatus — games (IGDB vocabulary)", () => {
  it("recognises IGDB pre-release values stored in the same column", () => {
    for (const s of UNRELEASED_IGDB_STATUSES) {
      expect(isUnreleasedStatus(s)).toBe(true)
    }
  })

  it("is case-insensitive, so a lowercase status can't bypass the gate", () => {
    // The trap: games write "rumored", TMDB writes "Rumored". A case-sensitive
    // includes() would have let the game through with its analysis showing.
    expect(isUnreleasedStatus("rumored")).toBe(true)
    expect(isUnreleasedStatus("Rumored")).toBe(true)
    expect(isUnreleasedStatus("post production")).toBe(true)
  })

  it("leaves playable games alone", () => {
    // early_access is publicly purchasable and played; offline/cancelled/
    // delisted describe games that WERE released.
    for (const s of ["released", "early_access", "offline", "cancelled", "delisted"]) {
      expect(isUnreleasedStatus(s)).toBe(false)
    }
  })

  it("keeps the IGDB numeric map and the gate vocabulary in sync", () => {
    expect([...Object.values(IGDB_UNRELEASED_STATUSES)].sort()).toEqual(
      [...UNRELEASED_IGDB_STATUSES].sort(),
    )
  })
})
