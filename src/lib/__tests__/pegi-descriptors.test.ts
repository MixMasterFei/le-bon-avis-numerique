import { describe, expect, it } from "vitest"
import {
  extractPegiDescriptors,
  pegiAgeFromOfficialRating,
  sortPegiDescriptors,
} from "@/lib/pegi-descriptors"

describe("extractPegiDescriptors", () => {
  it("maps IGDB PEGI category enums to French labels", () => {
    const descriptors = extractPegiDescriptors([
      {
        category: 2,
        rating: 3,
        rating_content_descriptions: [
          { category: 50 },
          { category: 55 },
          { category: 58 },
        ],
      },
    ])
    expect(descriptors).toEqual(["Violence", "Langage grossier", "Achats intégrés"])
  })

  it("maps v2 content descriptions (description text, no category) to French labels", () => {
    // The live IGDB AgeRatingContentDescriptionV2 object has no numeric
    // `category` — only `description`. This is what the query now returns after
    // dropping the invalid `.category` subfield that caused the 400.
    const descriptors = extractPegiDescriptors([
      {
        organization: 2, // PEGI
        rating_category: 3,
        rating_content_descriptions: [
          { description: "Violence" },
          { description: "Bad Language" },
          { description: "In-game purchases" },
        ],
      },
    ])
    expect(descriptors).toEqual(["Violence", "Langage grossier", "Achats intégrés"])
  })

  it("returns empty when no PEGI entry", () => {
    expect(extractPegiDescriptors([{ category: 1, rating: 4 }])).toEqual([])
  })
})

describe("sortPegiDescriptors", () => {
  it("orders known descriptors consistently", () => {
    expect(sortPegiDescriptors(["Achats intégrés", "Violence", "Peur"])).toEqual([
      "Violence",
      "Peur",
      "Achats intégrés",
    ])
  })
})

describe("pegiAgeFromOfficialRating", () => {
  it("parses PEGI_* codes", () => {
    expect(pegiAgeFromOfficialRating("PEGI_12")).toBe(12)
    expect(pegiAgeFromOfficialRating("CSA_12")).toBeNull()
  })
})
