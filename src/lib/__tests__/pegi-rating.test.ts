import { describe, expect, it } from "vitest"
import { getPegiInfo } from "@/lib/igdb"

/**
 * Guards the post-2025 IGDB AgeRatingCategory mapping. IGDB replaced the old
 * per-org `rating` enum (1–5) with a global `rating_category` enum; PEGI now
 * lives in block 8–12. These fixtures are the real shape returned for The
 * Witcher 3 (organization 2 / rating_category 12 = PEGI 18), with the other
 * organizations included to ensure we pick PEGI and ignore ESRB/USK/etc.
 */
describe("getPegiInfo — IGDB v4 rating_category", () => {
  const witcher3 = [
    { id: 222156, organization: 7, rating_category: 38 }, // ACB R18
    {
      id: 32441,
      organization: 2, // PEGI
      rating_category: 12, // PEGI 18
      rating_content_descriptions: [
        { id: 50, description: "Violence" },
        { id: 55, description: "Bad Language" },
        { id: 51, description: "Sex" },
      ],
    },
    { id: 46963, organization: 4, rating_category: 22 }, // USK 18
    { id: 187952, organization: 1, rating_category: 6 }, // ESRB M
  ]

  it("maps organization 2 / rating_category 12 to PEGI 18", () => {
    const info = getPegiInfo(witcher3)
    expect(info?.internal).toBe("PEGI_18")
    expect(info?.age).toBe(18)
  })

  it("extracts PEGI descriptors from the PEGI entry only", () => {
    const info = getPegiInfo(witcher3)
    expect(info?.descriptors).toEqual(["Violence", "Langage grossier", "Sexualité"])
  })

  it("maps the whole PEGI block (8–12)", () => {
    const band = (rc: number) => getPegiInfo([{ organization: 2, rating_category: rc }])?.internal
    expect(band(8)).toBe("PEGI_3")
    expect(band(9)).toBe("PEGI_7")
    expect(band(10)).toBe("PEGI_12")
    expect(band(11)).toBe("PEGI_16")
    expect(band(12)).toBe("PEGI_18")
  })

  it("still supports the legacy category/rating shape", () => {
    expect(getPegiInfo([{ category: 2, rating: 5 }])?.internal).toBe("PEGI_18")
    expect(getPegiInfo([{ category: 2, rating: 1 }])?.internal).toBe("PEGI_3")
  })

  it("returns null when there is no PEGI entry (ESRB only)", () => {
    expect(getPegiInfo([{ organization: 1, rating_category: 6 }])).toBeNull()
  })
})
