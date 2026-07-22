import { describe, it, expect } from "vitest"
import {
  FRESH_RELEASE_WINDOW_DAYS,
  RELEASE_ANALYSIS_GRACE_DAYS,
  freshlyReleasedWhere,
  overdueAnalysisWhere,
  unenrichedBacklogWhere,
} from "../enrich-filter"
import { UNRELEASED_TMDB_STATUSES } from "../release-status"

const DAY = 864e5

/** Minimal evaluator for the subset of Prisma predicates these builders emit. */
function matches(where: any, row: Record<string, any>): boolean {
  if (where.AND) return where.AND.every((w: any) => matches(w, row))
  if (where.OR) return where.OR.some((w: any) => matches(w, row))
  return Object.entries(where).every(([field, cond]) => {
    const v = row[field]
    if (cond === null) return v === null
    if (cond instanceof Date || typeof cond !== "object") return v === cond
    const c = cond as Record<string, any>
    if ("gte" in c && !(v && v >= c.gte)) return false
    if ("lte" in c && !(v && v <= c.lte)) return false
    if ("lt" in c && !(v && v < c.lt)) return false
    if ("notIn" in c) return v === null ? false : !c.notIn.includes(v)
    if ("not" in c) return c.not === null ? v !== null : v !== c.not
    return true
  })
}

const base = {
  isEnriched: false,
  releaseDate: new Date(Date.now() - 2 * DAY),
  releaseStatus: null as string | null,
}

describe("freshlyReleasedWhere", () => {
  it("matches a title released days ago that is still unanalysed", () => {
    expect(matches(freshlyReleasedWhere(), base)).toBe(true)
  })

  it("excludes an already-enriched title", () => {
    expect(matches(freshlyReleasedWhere(), { ...base, isEnriched: true })).toBe(false)
  })

  it("excludes a title that is not out yet", () => {
    expect(
      matches(freshlyReleasedWhere(), { ...base, releaseDate: new Date(Date.now() + 5 * DAY) }),
    ).toBe(false)
  })

  it("excludes every pre-release TMDB status", () => {
    for (const s of UNRELEASED_TMDB_STATUSES) {
      expect(matches(freshlyReleasedWhere(), { ...base, releaseStatus: s })).toBe(false)
    }
  })

  it("keeps rows with a null status (TMDB often leaves it blank — L'Odyssée did)", () => {
    expect(matches(freshlyReleasedWhere(), { ...base, releaseStatus: null })).toBe(true)
  })

  it("drops releases older than the fresh window", () => {
    const old = new Date(Date.now() - (FRESH_RELEASE_WINDOW_DAYS + 10) * DAY)
    expect(matches(freshlyReleasedWhere(), { ...base, releaseDate: old })).toBe(false)
  })

  it("excludes null-dated catalog rows (they have no release to be fresh from)", () => {
    expect(matches(freshlyReleasedWhere(), { ...base, releaseDate: null })).toBe(false)
  })
})

describe("overdueAnalysisWhere", () => {
  it("flags a title released past the grace period with no analysis", () => {
    const releaseDate = new Date(Date.now() - (RELEASE_ANALYSIS_GRACE_DAYS + 4) * DAY)
    expect(matches(overdueAnalysisWhere(), { ...base, releaseDate })).toBe(true)
  })

  it("does NOT flag a title still inside the grace period", () => {
    const releaseDate = new Date(Date.now() - 1 * DAY)
    expect(matches(overdueAnalysisWhere(), { ...base, releaseDate })).toBe(false)
  })

  it("does NOT flag an enriched title", () => {
    const releaseDate = new Date(Date.now() - 30 * DAY)
    expect(matches(overdueAnalysisWhere(), { ...base, releaseDate, isEnriched: true })).toBe(false)
  })

  it("does NOT flag an unreleased title", () => {
    expect(
      matches(overdueAnalysisWhere(), { ...base, releaseDate: new Date(Date.now() + 30 * DAY) }),
    ).toBe(false)
  })
})

describe("unenrichedBacklogWhere", () => {
  it("still accepts null-dated legacy rows (unchanged behaviour)", () => {
    expect(
      matches(unenrichedBacklogWhere(), { isEnriched: false, releaseDate: null, releaseStatus: null }),
    ).toBe(true)
  })
})
