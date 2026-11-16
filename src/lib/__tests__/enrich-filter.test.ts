import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_ENRICH_GRACE_DAYS,
  enrichCutoffDate,
  enrichGraceDays,
  isEnrichableRelease,
  notUnreleasedWhere,
  unenrichedBacklogWhere,
} from "../enrich-filter"

const ORIGINAL = process.env.ENRICH_RELEASE_GRACE_DAYS
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ENRICH_RELEASE_GRACE_DAYS
  else process.env.ENRICH_RELEASE_GRACE_DAYS = ORIGINAL
})

const DAY = 24 * 60 * 60 * 1000

describe("enrichGraceDays", () => {
  it("defaults to three days", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    expect(enrichGraceDays()).toBe(DEFAULT_ENRICH_GRACE_DAYS)
    expect(DEFAULT_ENRICH_GRACE_DAYS).toBe(3)
  })

  it("honours the override, including 0 (the pre-fix behaviour)", () => {
    process.env.ENRICH_RELEASE_GRACE_DAYS = "0"
    expect(enrichGraceDays()).toBe(0)
    process.env.ENRICH_RELEASE_GRACE_DAYS = "14"
    expect(enrichGraceDays()).toBe(14)
  })

  it("falls back to the default on garbage or negative input", () => {
    for (const v of ["", "   ", "abc", "-3"]) {
      process.env.ENRICH_RELEASE_GRACE_DAYS = v
      expect(enrichGraceDays()).toBe(DEFAULT_ENRICH_GRACE_DAYS)
    }
  })
})

describe("enrichCutoffDate", () => {
  it("sits a grace period behind now", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const now = new Date("2026-07-30T09:00:00Z")
    expect(enrichCutoffDate(now).toISOString()).toBe("2026-07-27T09:00:00.000Z")
  })

  it("would NOT have admitted Spider-Man on its release morning", () => {
    // The regression this guard exists for: released 2026-07-29 00:00, enriched
    // 06:31 the same day, six hours into its theatrical run.
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const enrichedAt = new Date("2026-07-29T06:31:58Z")
    const releasedAt = new Date("2026-07-29T00:00:00Z")
    expect(releasedAt.getTime()).toBeGreaterThan(enrichCutoffDate(enrichedAt).getTime())
  })

  it("admits the same title after the grace period", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const releasedAt = new Date("2026-07-29T00:00:00Z")
    const later = new Date(releasedAt.getTime() + 3 * DAY + 1)
    expect(releasedAt.getTime()).toBeLessThanOrEqual(enrichCutoffDate(later).getTime())
  })
})

describe("notUnreleasedWhere", () => {
  it("keeps null release dates eligible (old catalogue items)", () => {
    const w = notUnreleasedWhere() as { AND: Array<{ OR: Array<Record<string, unknown>> }> }
    expect(w.AND[0].OR).toContainEqual({ releaseDate: null })
  })

  it("bounds release date by the cutoff, not by now", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const w = notUnreleasedWhere() as { AND: Array<{ OR: Array<{ releaseDate?: { lte?: Date } }> }> }
    const lte = w.AND[0].OR.find((c) => c.releaseDate && "lte" in c.releaseDate)?.releaseDate?.lte
    expect(lte).toBeInstanceOf(Date)
    // Roughly three days back, allowing for the clock ticking during the test.
    const delta = Date.now() - (lte as Date).getTime()
    expect(delta).toBeGreaterThan(2.9 * DAY)
    expect(delta).toBeLessThan(3.1 * DAY)
  })

  it("is null-safe on releaseStatus", () => {
    const w = notUnreleasedWhere() as { AND: Array<{ OR: Array<Record<string, unknown>> }> }
    expect(w.AND[1].OR).toContainEqual({ releaseStatus: null })
  })
})

describe("unenrichedBacklogWhere", () => {
  it("is the release guard plus isEnriched:false, so the dashboard count matches", () => {
    const w = unenrichedBacklogWhere() as {
      AND: [unknown, { AND: Array<{ OR: Array<{ releaseDate?: { lte?: Date } }> }> }]
    }
    expect(w.AND[0]).toEqual({ isEnriched: false })
    // Structural comparison, not deep-equal: both calls evaluate their own
    // `new Date()` and would differ by a millisecond.
    const guard = w.AND[1]
    expect(guard.AND[0].OR).toContainEqual({ releaseDate: null })
    const lte = guard.AND[0].OR.find((c) => c.releaseDate && "lte" in c.releaseDate)?.releaseDate?.lte
    expect(lte).toBeInstanceOf(Date)
    expect(Object.keys(guard)).toEqual(Object.keys(notUnreleasedWhere()))
  })
})

describe("isEnrichableRelease (French certification shortcut)", () => {
  const now = new Date("2026-11-16T12:00:00Z")
  it("never admits an unreleased title, certified or not", () => {
    const d = new Date("2026-11-18T00:00:00Z")
    expect(isEnrichableRelease({ releaseDate: d, officialRating: "TOUS_PUBLICS" }, now)).toBe(false)
    expect(isEnrichableRelease({ releaseDate: d, officialRating: null }, now)).toBe(false)
  })
  it("admits a certified title on its release day", () => {
    const d = new Date("2026-11-16T00:00:00Z")
    expect(isEnrichableRelease({ releaseDate: d, officialRating: "CSA_12" }, now)).toBe(true)
  })
  it("holds an uncertified title for the grace period, then admits it", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    expect(isEnrichableRelease({ releaseDate: new Date("2026-11-14T00:00:00Z") }, now)).toBe(false)
    expect(isEnrichableRelease({ releaseDate: new Date("2026-11-13T00:00:00Z") }, now)).toBe(true)
  })
  it("keeps undated catalogue rows eligible", () => {
    expect(isEnrichableRelease({ releaseDate: null }, now)).toBe(true)
  })
  it("the Prisma predicate carries the certified-and-released branch", () => {
    const w = notUnreleasedWhere(now) as { AND: Array<{ OR: Array<Record<string, unknown>> }> }
    expect(w.AND[0].OR).toContainEqual({
      AND: [{ releaseDate: { lte: now } }, { officialRating: { not: null } }],
    })
  })
})
