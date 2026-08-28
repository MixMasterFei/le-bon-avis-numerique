import { describe, expect, it } from "vitest"
import { isOutOfSeason } from "../seasonal"

const AUGUST = 7
const NOVEMBER = 10
const DECEMBER = 11
const OCTOBER = 9

describe("isOutOfSeason", () => {
  it("drops Christmas titles outside November–December", () => {
    expect(isOutOfSeason({ title: "Le Rendez-vous de Noël" }, AUGUST)).toBe(true)
    expect(isOutOfSeason({ title: "Le Rendez-vous de Noël" }, NOVEMBER)).toBe(false)
    expect(isOutOfSeason({ title: "Le Rendez-vous de Noël" }, DECEMBER)).toBe(false)
  })

  it("matches on topics, not just the title", () => {
    // The title alone gives nothing away — enrichment's "Noël" topic is the
    // only signal ("Sesamoël" contains no "noel" substring).
    const elmo = { title: "Elmo et Mark Rober fêtent Sesamoël", topics: ["Famille", "Noël", "Musique"] }
    expect(isOutOfSeason(elmo, AUGUST)).toBe(true)
    expect(isOutOfSeason(elmo, DECEMBER)).toBe(false)
  })

  it("folds accents so noel and Noël both match", () => {
    expect(isOutOfSeason({ topics: ["noel"] }, AUGUST)).toBe(true)
    expect(isOutOfSeason({ topics: ["Noël"] }, AUGUST)).toBe(true)
  })

  it("catches English / marketing spellings", () => {
    expect(isOutOfSeason({ title: "Merry Giftmas" }, AUGUST)).toBe(true)
    expect(isOutOfSeason({ title: "A Christmas Prince" }, AUGUST)).toBe(true)
    expect(isOutOfSeason({ title: "Sesame Street: The Nutcracker" }, AUGUST)).toBe(true)
  })

  it("gates Halloween on October only", () => {
    expect(isOutOfSeason({ topics: ["halloween"] }, AUGUST)).toBe(true)
    expect(isOutOfSeason({ topics: ["halloween"] }, OCTOBER)).toBe(false)
    expect(isOutOfSeason({ topics: ["halloween"] }, DECEMBER)).toBe(true)
  })

  it("never swallows a non-seasonal title", () => {
    // Regression: an unbounded /advent/ would have matched every "Adventure".
    expect(isOutOfSeason({ title: "Adventure Time", genres: ["Aventure", "Adventure"] }, AUGUST)).toBe(false)
    expect(isOutOfSeason({ title: "Santana : le documentaire" }, AUGUST)).toBe(false)
    expect(isOutOfSeason({ title: "La Pat' Patrouille : Le film" }, AUGUST)).toBe(false)
    expect(isOutOfSeason({ title: "Cars : Quatre roues", genres: ["Animation"] }, AUGUST)).toBe(false)
  })
})
