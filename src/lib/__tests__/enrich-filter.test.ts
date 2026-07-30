import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_ENRICH_GRACE_DAYS,
  enrichCutoffDate,
  enrichGraceDays,
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
  it("defaults to a week", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    expect(enrichGraceDays()).toBe(DEFAULT_ENRICH_GRACE_DAYS)
    expect(DEFAULT_ENRICH_GRACE_DAYS).toBe(7)
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
    expect(enrichCutoffDate(now).toISOString()).toBe("2026-07-23T09:00:00.000Z")
  })

  it("would NOT have admitted Spider-Man on its release morning", () => {
    // The regression this guard exists for: released 2026-07-29 00:00, enriched
    // 06:31 the same day, six hours into its theatrical run.
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const enrichedAt = new Date("2026-07-29T06:31:58Z")
    const releasedAt = new Date("2026-07-29T00:00:00Z")
    expect(releasedAt.getTime()).toBeGreaterThan(enrichCutoffDate(enrichedAt).getTime())
  })

  it("admits the same title a week later", () => {
    delete process.env.ENRICH_RELEASE_GRACE_DAYS
    const releasedAt = new Date("2026-07-29T00:00:00Z")
    const later = new Date(releasedAt.getTime() + 8 * DAY)
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
    // Roughly a week back, allowing for the clock ticking during the test.
    const delta = Date.now() - (lte as Date).getTime()
    expect(delta).toBeGreaterThan(6.9 * DAY)
    expect(delta).toBeLessThan(7.1 * DAY)
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
