import { describe, expect, it } from "vitest"
import {
  dislikedGenresForHardExclusion,
  isHardBlockDislikedGenre,
  mergeDislikedGenres,
  partitionDislikedGenres,
} from "../disliked-genres"

describe("disliked-genres helpers", () => {
  it("partitions mature vs soft dislikes", () => {
    const { hardAvoid, softDislike } = partitionDislikedGenres(["Drame", "Horreur", "Thriller"])
    expect(hardAvoid).toEqual(["Horreur", "Thriller"])
    expect(softDislike).toEqual(["Drame"])
  })

  it("hard exclusion keeps only mature genres", () => {
    expect(dislikedGenresForHardExclusion(["Drame", "Crime", "Comédie"])).toEqual(["Crime"])
  })

  it("merges quiz lists for storage", () => {
    expect(mergeDislikedGenres(["Horreur"], ["Drame"])).toEqual(["Horreur", "Drame"])
  })

  it("detects hard block genres case-insensitively", () => {
    expect(isHardBlockDislikedGenre("horreur")).toBe(true)
    expect(isHardBlockDislikedGenre("Drame")).toBe(false)
  })
})
