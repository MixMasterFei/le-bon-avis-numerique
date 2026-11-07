import { describe, expect, it } from "vitest"
import { matchesWhere } from "@/test/prisma-where"

const row = { id: "x", votes: 5, rating: null as number | null, date: new Date("2026-11-01"), type: "MOVIE" }

describe("matchesWhere (test helper)", () => {
  it("applies SQL null semantics: NULL never satisfies a comparison, `not: x` included", () => {
    expect(matchesWhere(row, { rating: null })).toBe(true)
    expect(matchesWhere(row, { rating: { not: null } })).toBe(false)
    expect(matchesWhere(row, { rating: { lt: 10 } })).toBe(false)
    expect(matchesWhere(row, { rating: { not: 3 } })).toBe(false)
    expect(matchesWhere(row, { votes: { not: 3 } })).toBe(true)
  })

  it("compares dates by instant and supports in / notIn / ranges", () => {
    expect(matchesWhere(row, { date: new Date("2026-11-01") })).toBe(true)
    expect(matchesWhere(row, { date: { gte: new Date("2026-10-01"), lt: new Date("2026-11-01") } })).toBe(false)
    expect(matchesWhere(row, { type: { in: ["MOVIE", "TV"] }, votes: { notIn: [0] } })).toBe(true)
  })

  it("combines AND / OR / NOT, with an empty OR matching nothing", () => {
    expect(matchesWhere(row, { OR: [{ votes: 0 }, { AND: [{ votes: { gt: 1 } }, { NOT: { type: "TV" } }] }] })).toBe(true)
    expect(matchesWhere(row, { OR: [] })).toBe(false)
    expect(matchesWhere(row, { AND: [] })).toBe(true)
  })

  it("throws on an unknown operator or field instead of silently matching", () => {
    expect(() => matchesWhere(row, { votes: { has: 1 } })).toThrow(/unsupported operator/)
    expect(() => matchesWhere(row, { missing: 1 })).toThrow(/no field/)
  })
})
