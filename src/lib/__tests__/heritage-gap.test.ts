import { describe, expect, it } from "vitest"
import {
  normalizeTitle,
  matchesEntry,
  buildHeritageGap,
  type CatalogTitle,
} from "../heritage-gap"
import { HERITAGE_WATCHLIST, type HeritageEntry } from "../heritage-watchlist"

const entry = (over: Partial<HeritageEntry> = {}): HeritageEntry => ({
  title: "Les Visiteurs",
  year: 1993,
  type: "MOVIE",
  category: "fr-culte",
  ...over,
})

const row = (title: string, year: number | null, id = "x"): CatalogTitle => ({ id, title, year })

describe("normalizeTitle", () => {
  it("strips accents regardless of case", () => {
    // Regression: an ad-hoc SQL mirror of this function ran translate() before
    // lower(), so a leading uppercase "É" survived and the title never matched.
    expect(normalizeTitle("L'Étrange Noël de monsieur Jack")).toBe("l etrange noel de monsieur jack")
    expect(normalizeTitle("ÉTRANGE")).toBe("etrange")
  })

  it("folds punctuation, ampersands and spacing", () => {
    expect(normalizeTitle("Monstres & Cie")).toBe("monstres et cie")
    expect(normalizeTitle("S.O.S. Fantômes")).toBe("s o s fantomes")
    expect(normalizeTitle("Astérix & Obélix : Mission Cléopâtre")).toBe(
      "asterix et obelix mission cleopatre",
    )
  })
})

describe("matchesEntry", () => {
  it("does NOT match a longer title that merely contains the entry", () => {
    // The whole reason this is equality-based: an ILIKE '%les visiteurs%' would
    // report "Les Visiteurs" as present because of these two rows, when the
    // 1993 original is genuinely missing.
    expect(matchesEntry(entry(), row("Les Visiteurs d'un autre monde", 1978))).toBe(false)
    expect(matchesEntry(entry(), row("Les Visiteurs : La Révolution", 2016))).toBe(false)
    expect(matchesEntry(entry(), row("Les Visiteurs", 1993))).toBe(true)
  })

  it("rejects a remake outside the year window", () => {
    expect(matchesEntry(entry({ title: "La Guerre des boutons", year: 1962 }), row("La Guerre des boutons", 1994))).toBe(false)
    expect(matchesEntry(entry({ title: "La Guerre des boutons", year: 1962 }), row("La Guerre des boutons", 1962))).toBe(true)
  })

  it("tolerates a one-year drift in the release date", () => {
    // TMDB primary release dates vary by country; ±1 absorbs that without
    // letting a remake through.
    expect(matchesEntry(entry({ title: "Azur et Asmar", year: 2006 }), row("Azur et Asmar", 2007))).toBe(true)
  })

  it("matches through an alias", () => {
    const e = entry({ title: "Les Aventures de Rabbi Jacob", year: 1973, aliases: ["Rabbi Jacob"] })
    expect(matchesEntry(e, row("Rabbi Jacob", 1973))).toBe(true)
  })

  it("accepts an exact title match with an unknown year", () => {
    expect(matchesEntry(entry(), row("Les Visiteurs", null))).toBe(true)
  })
})

describe("buildHeritageGap", () => {
  it("counts present vs missing and groups by category", () => {
    const gap = buildHeritageGap([
      row("Le Gendarme de Saint-Tropez", 1964, "a"),
      row("Les Visiteurs d'un autre monde", 1978, "b"), // decoy, must not count
    ])

    const stTropez = gap.rows.find((r) => r.entry.title === "Le Gendarme de Saint-Tropez")
    expect(stTropez?.present).toBe(true)
    expect(stTropez?.matchedId).toBe("a")

    const visiteurs = gap.rows.find((r) => r.entry.title === "Les Visiteurs")
    expect(visiteurs?.present).toBe(false)

    expect(gap.total).toBe(HERITAGE_WATCHLIST.length)
    expect(gap.present + gap.missing).toBe(gap.total)
  })

  it("reports every watchlist entry exactly once", () => {
    const gap = buildHeritageGap([])
    expect(gap.rows).toHaveLength(HERITAGE_WATCHLIST.length)
    expect(gap.missing).toBe(HERITAGE_WATCHLIST.length)
    expect(gap.byCategory.reduce((s, c) => s + c.total, 0)).toBe(HERITAGE_WATCHLIST.length)
  })
})

describe("HERITAGE_WATCHLIST hygiene", () => {
  it("has no duplicate title+year pairs", () => {
    const keys = HERITAGE_WATCHLIST.map((e) => `${normalizeTitle(e.title)}|${e.year}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("carries plausible release years", () => {
    for (const e of HERITAGE_WATCHLIST) {
      expect(e.year).toBeGreaterThan(1900)
      expect(e.year).toBeLessThan(2030)
    }
  })
})
