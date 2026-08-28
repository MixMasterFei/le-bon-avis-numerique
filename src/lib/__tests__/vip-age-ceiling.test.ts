import { describe, expect, it } from "vitest"
import type { Prisma } from "@prisma/client"
import { applyAgeFilter } from "../media-queries"

// The VIP-brand bypass may lift a young classic past a MIN age bound, but must
// never raise content above the caller's MAX — a parent's age cap is a safety
// promise. Regression: maxAge=10 rails served VIP-tagged PEGI-12 games and a
// maxAge=6 rail served age-10 VIP films (live smoke test, Aug 2026).
function vipBranchCeiling(minAge?: number, maxAge?: number): number | null {
  const where: Prisma.MediaItemWhereInput = {}
  applyAgeFilter(where, minAge, maxAge)
  const ands = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
  for (const clause of ands) {
    const or = (clause as { OR?: Prisma.MediaItemWhereInput[] }).OR
    if (!or) continue
    for (const branch of or) {
      const inner = Array.isArray(branch.AND) ? branch.AND : branch.AND ? [branch.AND] : []
      const vip = inner.find((c) => (c as { topics?: unknown }).topics)
      const age = inner.find((c) => (c as { expertAgeRec?: unknown }).expertAgeRec)
      if (vip && age) {
        const rec = (age as { expertAgeRec: { lte?: number } }).expertAgeRec
        return typeof rec.lte === "number" ? rec.lte : null
      }
    }
  }
  return null
}

describe("VIP-brand age bypass", () => {
  it("never exceeds the caller's maxAge", () => {
    expect(vipBranchCeiling(undefined, 10)).toBeLessThanOrEqual(10)
    expect(vipBranchCeiling(undefined, 6)).toBeLessThanOrEqual(6)
    expect(vipBranchCeiling(4, 8)).toBeLessThanOrEqual(8)
  })

  it("keeps the family ceiling when the caller is more permissive", () => {
    expect(vipBranchCeiling(undefined, 16)).toBe(12)
    expect(vipBranchCeiling(8, undefined)).toBe(12)
  })
})
