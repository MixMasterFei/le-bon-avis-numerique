import { describe, expect, it } from "vitest"
import { parseCataloguePage, parsePagination } from "./pagination"

describe("pagination validation", () => {
  it("allows real catalogue pages beyond the old 100-page cutoff", () => {
    expect(parseCataloguePage("222")).toBe(222)
    expect(parseCataloguePage(null)).toBe(1)
  })
  it.each(["", "0", "-1", "1.5", "2abc", "01", " 2", "1e3", "9007199254740992", "2147483647"])("rejects invalid or overflowing pages: %s", raw => {
    expect(parseCataloguePage(raw)).toBeNull()
  })
  it("bounds database workload without silently accepting invalid limits", () => {
    expect(parsePagination("2", "100")).toEqual({ page: 2, limit: 100, skip: 100 })
    expect(parsePagination(null, null)).toEqual({ page: 1, limit: 20, skip: 0 })
    for (const limit of ["0", "-1", "101", "100000", "NaN", "20x"]) {
      expect(parsePagination("1", limit)).toBeNull()
    }
  })
})
