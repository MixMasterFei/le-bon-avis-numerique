import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { getAgeCategory, getMemberAge } from "../age-utils"

describe("getAgeCategory", () => {
  it("labels the boundary ages per band", () => {
    expect(getAgeCategory(3).label).toBe("Tout-petit")
    expect(getAgeCategory(4).label).toBe("Enfant")
    expect(getAgeCategory(7).label).toBe("Enfant")
    expect(getAgeCategory(8).label).toBe("Pré-ado")
    expect(getAgeCategory(12).label).toBe("Pré-ado")
    expect(getAgeCategory(13).label).toBe("Ado")
    expect(getAgeCategory(15).label).toBe("Ado")
    expect(getAgeCategory(16).label).toBe("Grand ado")
    expect(getAgeCategory(17).label).toBe("Grand ado")
    expect(getAgeCategory(18).label).toBe("Adulte")
    expect(getAgeCategory(40).label).toBe("Adulte")
  })

  it("handles age 0", () => {
    expect(getAgeCategory(0).label).toBe("Tout-petit")
  })
})

describe("getMemberAge", () => {
  // Pin "now" so the birthday logic is deterministic. 16 June 2026 → month 6.
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-16T12:00:00Z"))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it("returns null when birth year is missing or falsy", () => {
    expect(getMemberAge(null)).toBeNull()
    expect(getMemberAge(0)).toBeNull()
  })

  it("computes a year-only age when no birth month is given", () => {
    expect(getMemberAge(2016)).toBe(10)
    expect(getMemberAge(2016, null)).toBe(10)
  })

  it("counts the birthday as reached in the current month", () => {
    // birthMonth === current month (June) → not subtracted
    expect(getMemberAge(2016, 6)).toBe(10)
  })

  it("subtracts a year when the birthday is later this year", () => {
    // July is after the pinned June → birthday hasn't happened yet
    expect(getMemberAge(2016, 7)).toBe(9)
    expect(getMemberAge(2016, 12)).toBe(9)
  })

  it("does not subtract when the birthday already passed this year", () => {
    expect(getMemberAge(2016, 1)).toBe(10)
    expect(getMemberAge(2016, 5)).toBe(10)
  })

  it("ignores out-of-range birth months and falls back to year-only", () => {
    expect(getMemberAge(2016, 0)).toBe(10)
    expect(getMemberAge(2016, 13)).toBe(10)
  })
})
