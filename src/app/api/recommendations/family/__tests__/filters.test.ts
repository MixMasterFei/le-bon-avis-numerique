import { describe, expect, it } from "vitest"
import { buildFamilyRecsFilters } from "../filters"

describe("buildFamilyRecsFilters", () => {
  it("caps the age filter to youngestAge", () => {
    const { ageFilter } = buildFamilyRecsFilters({
      youngestAge: 8,
      dislikedGenres: [],
      avoidTopics: [],
    })
    expect(ageFilter).toEqual({ expertAgeRec: { lte: 8 } })
  })

  it("caps the age filter for an all-adults family too (no expertAgeRec:null loophole)", () => {
    const { ageFilter } = buildFamilyRecsFilters({
      youngestAge: 17,
      dislikedGenres: [],
      avoidTopics: [],
    })
    expect(ageFilter).toEqual({ expertAgeRec: { lte: 17 } })
    // explicitly: no OR clause that lets nulls through
    expect((ageFilter as Record<string, unknown>).OR).toBeUndefined()
  })

  it("returns an empty age filter when youngestAge is null", () => {
    const { ageFilter } = buildFamilyRecsFilters({
      youngestAge: null,
      dislikedGenres: [],
      avoidTopics: [],
    })
    expect(ageFilter).toEqual({})
  })

  it("pushes disliked genres into a NOT clause", () => {
    const { exclusionFilter } = buildFamilyRecsFilters({
      youngestAge: 10,
      dislikedGenres: ["Horreur", "Thriller"],
      avoidTopics: [],
    })
    expect(exclusionFilter.NOT).toEqual([
      { genres: { hasSome: ["Horreur", "Thriller"] } },
    ])
  })

  it("pushes avoid topics into both genre and topic NOT clauses", () => {
    const { exclusionFilter } = buildFamilyRecsFilters({
      youngestAge: 10,
      dislikedGenres: [],
      avoidTopics: ["Guerre"],
    })
    expect(exclusionFilter.NOT).toEqual([
      { genres: { hasSome: ["Guerre"] } },
      { topics: { hasSome: ["Guerre"] } },
    ])
  })

  it("combines disliked + avoid into a single NOT array", () => {
    const { exclusionFilter } = buildFamilyRecsFilters({
      youngestAge: 10,
      dislikedGenres: ["Horreur"],
      avoidTopics: ["Guerre"],
    })
    expect(exclusionFilter.NOT).toEqual([
      { genres: { hasSome: ["Horreur"] } },
      { genres: { hasSome: ["Guerre"] } },
      { topics: { hasSome: ["Guerre"] } },
    ])
  })

  it("deduplicates repeated genres across members", () => {
    const { exclusionFilter } = buildFamilyRecsFilters({
      youngestAge: 10,
      dislikedGenres: ["Horreur", "Horreur", "Thriller"],
      avoidTopics: [],
    })
    const not = exclusionFilter.NOT as Array<{ genres: { hasSome: string[] } }>
    expect(not[0].genres.hasSome).toEqual(["Horreur", "Thriller"])
  })

  it("returns an empty exclusion when nothing is disliked or avoided", () => {
    const { exclusionFilter } = buildFamilyRecsFilters({
      youngestAge: 10,
      dislikedGenres: [],
      avoidTopics: [],
    })
    expect(exclusionFilter).toEqual({})
  })
})
