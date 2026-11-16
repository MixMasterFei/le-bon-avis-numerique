import { describe, expect, it } from "vitest"
import { homonymLabel } from "../homonyms"

const now = new Date("2026-11-16T12:00:00Z")
const row = { id: "x", type: "MOVIE", title: "Scrooge", releaseDate: "2026-11-11", expertAgeRec: 8, isEnriched: false }

describe("homonymLabel", () => {
  it("names the year and flags a provisional age", () => {
    expect(homonymLabel(row, now)).toBe("Scrooge (2026) · dès 8 ans (à confirmer)")
  })
  it("states an evaluated age plainly, « tous publics » included", () => {
    expect(homonymLabel({ ...row, releaseDate: "1970-11-05", isEnriched: true }, now)).toBe("Scrooge (1970) · dès 8 ans")
    expect(homonymLabel({ ...row, expertAgeRec: 0, isEnriched: true }, now)).toBe("Scrooge (2026) · tous publics")
  })
  it("marks an upcoming title and omits an unknown age or year", () => {
    expect(homonymLabel({ ...row, releaseDate: "2027-03-01", expertAgeRec: null }, now)).toBe("Scrooge (2027) · à venir")
    expect(homonymLabel({ ...row, releaseDate: null, expertAgeRec: null }, now)).toBe("Scrooge")
  })
})
