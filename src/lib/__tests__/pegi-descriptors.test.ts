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
