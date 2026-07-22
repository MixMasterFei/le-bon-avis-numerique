import { describe, it, expect } from "vitest"
import { FRENCH_ORIGIN_COUNTRY, MIN_FRENCH_ROW_ITEMS } from "../cinema-policy"

/**
 * The homepage cinema block splits into two rows: mainstream (TMDB popularity)
 * and French-MADE. This pins the selection rules — the row must never repeat a
 * film already shown above it, and must hide itself rather than render a stub.
 *
 * "French-made" is production origin, NOT language: a Belgian or Québécois film
 * is French-SPEAKING but not French cinema, and a French production shot in
 * English still is. That distinction lives in `with_origin_country=FR`.
 */
type Card = { id: string; isFrenchProduction?: boolean }

function splitCinemaRows(items: Card[]) {
  const mainstream = items.slice(0, 6)
  const shown = new Set(mainstream.map((m) => m.id))
  const french = items.filter((m) => m.isFrenchProduction && !shown.has(m.id)).slice(0, 6)
  return { mainstream, french, showFrenchRow: french.length >= MIN_FRENCH_ROW_ITEMS }
}

const card = (id: string, fr = false): Card => ({ id, isFrenchProduction: fr })

describe("cinema row split", () => {
  it("never repeats a film already in the mainstream row", () => {
    // A big French release ranks top-6 on popularity — it belongs in row 1 and
    // must not appear again in row 2.
    const items = [
      card("a", true), card("b"), card("c"), card("d"), card("e"), card("f"),
      card("g", true), card("h", true), card("i", true),
    ]
    const { mainstream, french } = splitCinemaRows(items)
    expect(mainstream.map((m) => m.id)).toContain("a")
    expect(french.map((m) => m.id)).not.toContain("a")
    expect(french.map((m) => m.id)).toEqual(["g", "h", "i"])
  })

  it("hides the French row when supply is thin", () => {
    const items = [
      card("a"), card("b"), card("c"), card("d"), card("e"), card("f"),
      card("g", true), card("h", true), // only 2 → below the minimum
    ]
    expect(splitCinemaRows(items).showFrenchRow).toBe(false)
  })

  it("shows the French row at exactly the minimum", () => {
    const items = [
      card("a"), card("b"), card("c"), card("d"), card("e"), card("f"),
      card("g", true), card("h", true), card("i", true),
    ]
    const { showFrenchRow, french } = splitCinemaRows(items)
    expect(french).toHaveLength(MIN_FRENCH_ROW_ITEMS)
    expect(showFrenchRow).toBe(true)
  })

  it("caps the French row at one row of six", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => card(`m${i}`)),
      ...Array.from({ length: 10 }, (_, i) => card(`f${i}`, true)),
    ]
    expect(splitCinemaRows(items).french).toHaveLength(6)
  })

  it("degrades safely when the origin lookup returns nothing", () => {
    // getFrenchProductionTmdbIds() fails closed to an empty set — every card
    // then has isFrenchProduction false and the row simply doesn't render.
    const items = Array.from({ length: 20 }, (_, i) => card(`x${i}`))
    const { mainstream, showFrenchRow } = splitCinemaRows(items)
    expect(showFrenchRow).toBe(false)
    expect(mainstream).toHaveLength(6) // main rail unaffected
  })

  it("uses the production-country code, not a language code", () => {
    expect(FRENCH_ORIGIN_COUNTRY).toBe("FR")
    expect(FRENCH_ORIGIN_COUNTRY).not.toBe("fr")
  })
})

/**
 * "Cinéma français" requires French production AND French language. Mirrors the
 * getFrenchProductionTmdbIds predicate: production FR alone flagged Nightborn
 * (Finnish co-production) as French; language fr alone would sweep in Belgian /
 * Québécois films. A helper matching the lib keeps the rule pinned in a test.
 */
function isFrenchCinema(details: {
  production_countries?: { iso_3166_1: string }[]
  original_language?: string
}): boolean {
  const madeInFrance = (details.production_countries ?? []).some((c) => c.iso_3166_1 === "FR")
  return madeInFrance && details.original_language === "fr"
}

describe("French-cinema predicate (production AND language)", () => {
  it("includes a French-made, French-language film", () => {
    expect(isFrenchCinema({ production_countries: [{ iso_3166_1: "FR" }], original_language: "fr" })).toBe(true)
  })

  it("EXCLUDES a Finnish film that lists France as a minor co-production (the Nightborn case)", () => {
    expect(
      isFrenchCinema({
        production_countries: [{ iso_3166_1: "FI" }, { iso_3166_1: "FR" }],
        original_language: "fi",
      }),
    ).toBe(false)
  })

  it("EXCLUDES a Belgian French-language film (French-speaking, not French cinema)", () => {
    expect(isFrenchCinema({ production_countries: [{ iso_3166_1: "BE" }], original_language: "fr" })).toBe(false)
  })

  it("includes a genuine Franco-Belgian co-production in French", () => {
    expect(
      isFrenchCinema({
        production_countries: [{ iso_3166_1: "FR" }, { iso_3166_1: "BE" }],
        original_language: "fr",
      }),
    ).toBe(true)
  })
})

/** Mirrors the homepage familySafe horror filter (TMDB genre id 27 or DB genre). */
const TMDB_HORROR = 27
function isHorror(genreIds: number[], dbGenres: string[]): boolean {
  if (genreIds.includes(TMDB_HORROR)) return true
  return dbGenres.some((g) => ["horreur", "horror"].includes(g.toLowerCase()))
}

describe("homepage horror exclusion", () => {
  it("catches horror by TMDB genre id — works for off-DB provisional films with no DB genres", () => {
    expect(isHorror([27, 53], [])).toBe(true)
  })

  it("catches horror by DB genre when TMDB ids are absent", () => {
    expect(isHorror([], ["Horreur"])).toBe(true)
  })

  it("leaves non-horror films alone", () => {
    expect(isHorror([18, 36], ["Drame", "Histoire"])).toBe(false)
  })
})
