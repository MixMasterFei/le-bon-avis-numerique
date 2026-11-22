import { describe, expect, it } from "vitest"
import { noelFicheLink, NOEL_FICHE_LINK_TITLE } from "../noel/fiche-link"
import {
  NOEL_COLLECTION,
  NOEL_COLLECTION_ID,
  NOEL_FILMS_PATH,
  NOEL_GAMES_PATH,
  NOEL_HUB_PATH,
  NOEL_PAGES,
  noelCrossLinks,
} from "../noel/pages"
import { COLLECTIONS } from "../collections-data"

const AUGUST = 7
const NOVEMBER = 10
const DECEMBER = 11
const JANUARY = 0

describe("noelFicheLink — which fiches carry the « Noël en famille » card", () => {
  const grinch = { type: "MOVIE", title: "Le Grinch", genres: ["Familial", "Comédie"], topics: ["Noël"] }

  it("links a Christmas film to the films page, in November and December only", () => {
    for (const month0 of [NOVEMBER, DECEMBER]) {
      expect(noelFicheLink(grinch, { month0, isGiftGame: false })).toMatchObject({
        href: NOEL_FILMS_PATH,
        title: NOEL_FICHE_LINK_TITLE,
      })
    }
    expect(noelFicheLink(grinch, { month0: JANUARY, isGiftGame: false })).toBeNull()
    expect(noelFicheLink(grinch, { month0: AUGUST, isGiftGame: false })).toBeNull()
  })

  it("uses the seasonal matcher: topics count, not just the title", () => {
    // « Scrooge » (2026) is matched by its title; a fiche whose only signal is
    // the enrichment topic is matched too.
    expect(noelFicheLink({ type: "MOVIE", title: "Scrooge", genres: [], topics: [] }, { month0: DECEMBER, isGiftGame: false })?.href).toBe(NOEL_FILMS_PATH)
    expect(
      noelFicheLink(
        { type: "MOVIE", title: "Elmo et Mark Rober fêtent Sesamoël", genres: [], topics: ["Noël"] },
        { month0: DECEMBER, isGiftGame: false },
      )?.href,
    ).toBe(NOEL_FILMS_PATH)
  })

  it("links Christmas series to the films page as well", () => {
    expect(noelFicheLink({ type: "TV", title: "Une série", topics: ["noel"] }, { month0: NOVEMBER, isGiftGame: false })?.href).toBe(NOEL_FILMS_PATH)
  })

  it("leaves a non-Christmas film without a card", () => {
    // « La Reine des neiges » carries no Christmas signal in title, genres or topics.
    expect(
      noelFicheLink(
        { type: "MOVIE", title: "La Reine des neiges", genres: ["Animation"], topics: ["Magie", "Contes"] },
        { month0: DECEMBER, isGiftGame: false },
      ),
    ).toBeNull()
  })

  it("links a game only when the gift page lists it — a Christmas title is not enough", () => {
    const game = { type: "GAME", title: "Super Mario Odyssey", genres: ["Plateforme"], topics: [] }
    expect(noelFicheLink(game, { month0: DECEMBER, isGiftGame: true })?.href).toBe(NOEL_GAMES_PATH)
    expect(noelFicheLink(game, { month0: DECEMBER, isGiftGame: false })).toBeNull()
    expect(noelFicheLink({ ...game, title: "Christmas Game" }, { month0: DECEMBER, isGiftGame: false })).toBeNull()
    expect(noelFicheLink(game, { month0: AUGUST, isGiftGame: true })).toBeNull()
  })

  it("never links books, mangas or apps", () => {
    for (const type of ["BOOK", "MANGA", "APP"]) {
      expect(noelFicheLink({ type, title: "Un conte de Noël", topics: ["Noël"] }, { month0: DECEMBER, isGiftGame: true })).toBeNull()
    }
  })
})

describe("noelCrossLinks — the four Noël pages reach one another", () => {
  const all = [NOEL_HUB_PATH, ...NOEL_PAGES.map((p) => p.path), NOEL_COLLECTION.path]

  it("lists every other page, never the current one", () => {
    for (const current of all) {
      const paths = noelCrossLinks(current).map((p) => p.path)
      expect(paths).not.toContain(current)
      expect(new Set(paths)).toEqual(new Set(all.filter((p) => p !== current)))
    }
  })

  it("points at a collection that exists", () => {
    expect(COLLECTIONS.some((c) => c.id === NOEL_COLLECTION_ID)).toBe(true)
    expect(NOEL_COLLECTION.path).toBe(`/collections/${NOEL_COLLECTION_ID}`)
  })
})
