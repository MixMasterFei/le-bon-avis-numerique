import { describe, it, expect } from "vitest"
import {
  guideFreshness,
  auditGuideFreshness,
  REVIEW_INTERVAL_DAYS,
  STALE_AFTER_DAYS,
} from "@/lib/game-guide-freshness"
import { GAME_GUIDES, type GameGuide } from "@/lib/game-guides"

/** Minimal guide carrying only what the freshness audit reads. */
function guideWith(verifiedOn: string): GameGuide {
  return {
    ...GAME_GUIDES[0],
    key: "test",
    name: "Jeu Test",
    stateOfPlay: { ...GAME_GUIDES[0].stateOfPlay, verifiedOn },
  }
}

const NOW = new Date("2026-08-19T12:00:00.000Z")

/** ISO date `days` before NOW. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

describe("guideFreshness", () => {
  it("counts age in whole days from the verification date", () => {
    expect(guideFreshness(guideWith(daysAgo(5)), NOW).ageDays).toBe(5)
  })

  it("is fresh inside the review interval", () => {
    const r = guideFreshness(guideWith(daysAgo(REVIEW_INTERVAL_DAYS - 1)), NOW)
    expect(r.state).toBe("fresh")
  })

  it("is due at the review interval", () => {
    expect(guideFreshness(guideWith(daysAgo(REVIEW_INTERVAL_DAYS)), NOW).state).toBe("due")
  })

  it("stays due through the grace window, so a 31-day month is not an alert", () => {
    expect(guideFreshness(guideWith(daysAgo(STALE_AFTER_DAYS)), NOW).state).toBe("due")
  })

  it("goes stale past the grace window", () => {
    expect(guideFreshness(guideWith(daysAgo(STALE_AFTER_DAYS + 1)), NOW).state).toBe("stale")
  })

  // The dangerous case: a future date would read as eternally fresh and the
  // block would never be reviewed again. It must fail loud, not quietly pass.
  it("rejects a verification date in the future rather than treating it as fresh", () => {
    const r = guideFreshness(guideWith("2027-01-01"), NOW)
    expect(r.state).toBe("invalid")
    expect(r.problem).toMatch(/futur/i)
  })

  it("rejects a malformed date", () => {
    expect(guideFreshness(guideWith("19/08/2026"), NOW).state).toBe("invalid")
    expect(guideFreshness(guideWith(""), NOW).state).toBe("invalid")
  })

  it("rejects a calendar-impossible date instead of rolling it over", () => {
    // Date() would silently turn 2026-02-31 into 2026-03-03.
    expect(guideFreshness(guideWith("2026-02-31"), NOW).state).toBe("invalid")
  })
})

describe("auditGuideFreshness", () => {
  it("buckets every guide exactly once", () => {
    const a = auditGuideFreshness(NOW)
    expect(a.checked).toBe(GAME_GUIDES.length)
    expect(a.fresh.length + a.due.length + a.stale.length + a.invalid.length).toBe(a.checked)
  })

  it("needsAttention only when something is due, stale or invalid", () => {
    const allFresh = auditGuideFreshness(NOW, [guideWith(daysAgo(1))])
    expect(allFresh.needsAttention).toBe(false)

    const oneDue = auditGuideFreshness(NOW, [guideWith(daysAgo(1)), guideWith(daysAgo(90))])
    expect(oneDue.needsAttention).toBe(true)
    expect(oneDue.stale).toHaveLength(1)
  })
})

describe("the shipped guides", () => {
  it("all carry a parseable, non-future verification date", () => {
    const bad = auditGuideFreshness(new Date()).invalid
    expect(bad.map((g) => `${g.name}: ${g.problem}`)).toEqual([])
  })
})
