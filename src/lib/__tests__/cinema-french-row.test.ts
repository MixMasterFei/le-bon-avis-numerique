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
