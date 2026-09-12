import { describe, expect, it } from "vitest"
import { normalizePlatforms } from "@/lib/igdb"

const p = (...names: string[]) => names.map((name) => ({ name }))

describe("normalizePlatforms", () => {
  it("keeps only modern console/PC platforms for a multi-platform game — mobile ports stay unlisted", () => {
    expect(
      normalizePlatforms(p("Nintendo Switch", "PC (Microsoft Windows)", "iOS", "Android", "PlayStation 3")),
    ).toEqual(["Switch", "PC"])
  })

  it("falls back to the mobile platforms for a phone-only title instead of an empty list", () => {
    // Brawl Stars, Clash Royale, Toca Life… — an empty list reads as
    // "platform unknown" on the fiche, which is worse than "iOS, Android".
    expect(normalizePlatforms(p("iOS", "Android"))).toEqual(["iOS", "Android"])
    expect(normalizePlatforms(p("Android"))).toEqual(["Android"])
  })

  it("still returns nothing for a title with neither modern nor mobile platforms", () => {
    expect(normalizePlatforms(p("PlayStation 3", "Xbox 360", "Linux"))).toEqual([])
    expect(normalizePlatforms(undefined)).toEqual([])
  })
})
