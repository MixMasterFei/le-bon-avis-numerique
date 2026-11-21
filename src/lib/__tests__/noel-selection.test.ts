import { describe, expect, it } from "vitest"
import {
  NOEL_AGE_BANDS,
  bandForAge,
  dropAddOns,
  effectiveGameAge,
  familyCinemaPicks,
  giftOrder,
  giftPlatforms,
  groupByBand,
  homonymTitles,
  needsYear,
  onCurrentConsole,
  pegiAge,
  weightedRating,
} from "../noel/selection"
import { noelBreadcrumbJsonLd, noelItemListJsonLd } from "../noel/structured-data"
import { NOEL_HUB_PATH, NOEL_PAGES } from "../noel/pages"
import { isChristmasSeason, isChristmasThemed } from "../seasonal"
import { COLLECTIONS, collectionHighlights } from "../collections-data"
import { staticPageEntries } from "../sitemap"

describe("bandForAge", () => {
  it("puts « Tous publics » (0) in the youngest band", () => {
    expect(bandForAge(0)?.key).toBe("3-5")
  })

  it("places each band boundary in exactly one band", () => {
    expect(bandForAge(5)?.key).toBe("3-5")
    expect(bandForAge(6)?.key).toBe("6-8")
    expect(bandForAge(8)?.key).toBe("6-8")
    expect(bandForAge(9)?.key).toBe("9-11")
    expect(bandForAge(11)?.key).toBe("9-11")
    expect(bandForAge(12)?.key).toBe("12-14")
    expect(bandForAge(14)?.key).toBe("12-14")
  })

  it("leaves unknown ages and ages past the oldest band out", () => {
    expect(bandForAge(null)).toBeNull()
    expect(bandForAge(undefined)).toBeNull()
    expect(bandForAge(15)).toBeNull()
    expect(bandForAge(18)).toBeNull()
  })

  it("covers 0 to 14 without a gap", () => {
    for (let age = 0; age <= 14; age++) expect(bandForAge(age)).not.toBeNull()
    expect(NOEL_AGE_BANDS.map((b) => b.label)).toEqual(["3 à 5 ans", "6 à 8 ans", "9 à 11 ans", "12 ans et plus"])
  })
})

describe("game age", () => {
  it("reads PEGI codes only", () => {
    expect(pegiAge("PEGI_12")).toBe(12)
    expect(pegiAge("PEGI_3")).toBe(3)
    expect(pegiAge("TP")).toBeNull()
    expect(pegiAge(null)).toBeNull()
  })

  it("never places a game younger than its PEGI", () => {
    // Our age below the PEGI (data drift): the PEGI wins.
    expect(effectiveGameAge(9, "PEGI_12")).toBe(12)
    expect(bandForAge(effectiveGameAge(9, "PEGI_12"))?.key).toBe("12-14")
    // Our age above the PEGI (the usual case): our age wins.
    expect(effectiveGameAge(8, "PEGI_3")).toBe(8)
    expect(effectiveGameAge(7, null)).toBe(7)
    expect(effectiveGameAge(null, "PEGI_7")).toBeNull()
  })
})

describe("weightedRating", () => {
  it("does not let a handful of votes outrank a crowd", () => {
    const obscure = weightedRating(9.5, 12, 200, 6.5)
    const classic = weightedRating(8, 4000, 200, 6.5)
    expect(classic).toBeGreaterThan(obscure)
  })

  it("falls back to the prior with no votes", () => {
    expect(weightedRating(null, null, 50, 7)).toBe(7)
  })
})

describe("dropAddOns", () => {
  it("drops an add-on whose base game is in the pool", () => {
    const pool = [
      { title: "Animal Crossing: New Horizons" },
      { title: "Animal Crossing: New Horizons - Happy Home Paradise" },
      { title: "Elden Ring" },
      { title: "Elden Ring: Shadow of the Erdtree" },
    ]
    expect(dropAddOns(pool).map((g) => g.title)).toEqual(["Animal Crossing: New Horizons", "Elden Ring"])
  })

  it("keeps a subtitled game whose « base » is not a candidate", () => {
    const pool = [{ title: "The Legend of Zelda: Echoes of Wisdom" }, { title: "Mario Kart 8 Deluxe" }]
    expect(dropAddOns(pool)).toHaveLength(2)
  })

  it("does not treat a longer title sharing a prefix as an add-on", () => {
    // « Mario Kart 8 Deluxe » starts with « Mario Kart 8 » but without « : » / « - ».
    const pool = [{ title: "Mario Kart 8" }, { title: "Mario Kart 8 Deluxe" }]
    expect(dropAddOns(pool)).toHaveLength(2)
  })
})

describe("homonyms", () => {
  it("flags titles shown twice, accent- and case-insensitively", () => {
    const h = homonymTitles([{ title: "Scrooge" }, { title: "scrooge" }, { title: "Klaus" }])
    expect(needsYear("Scrooge", h)).toBe(true)
    expect(needsYear("Klaus", h)).toBe(false)
  })
})

describe("groupByBand", () => {
  const items = [
    { t: "a", age: 0 },
    { t: "b", age: 7 },
    { t: "c", age: 6 },
    { t: "d", age: 16 },
    { t: "e", age: 8 },
    { t: "f", age: null },
  ]

  it("keeps rank order inside a band and caps each band", () => {
    const groups = groupByBand(items, (i) => i.age, 2)
    expect(groups.map((g) => g.items.map((i) => i.t))).toEqual([["a"], ["b", "c"], [], []])
  })

  it("keeps empty bands so the page can say so", () => {
    expect(groupByBand([], (i: { age: number }) => i.age, 5)).toHaveLength(NOEL_AGE_BANDS.length)
  })
})

describe("giftOrder", () => {
  const now = new Date("2026-11-21T00:00:00Z")
  const g = (title: string, score: number, date: string) => ({ title, score, releaseDate: new Date(date) })

  it("leads with up to N recent releases, then the best of the rest", () => {
    const items = [
      g("classique", 9, "2017-10-27"),
      g("récent moyen", 7, "2026-04-10"),
      g("très bon ancien", 8.5, "2019-06-01"),
      g("récent bon", 8, "2025-10-16"),
      g("récent faible", 6, "2026-09-01"),
    ]
    expect(giftOrder(items, now, 18, 2).map((i) => i.title)).toEqual([
      "récent bon",
      "récent moyen",
      "classique",
      "très bon ancien",
      "récent faible",
    ])
  })
})

describe("platforms", () => {
  it("prints current machines only, in a stable order", () => {
    expect(giftPlatforms(["PC", "PS4", "Switch", "PS5", "Xbox One"])).toEqual(["Switch", "PS5", "PC"])
    expect(giftPlatforms(null)).toEqual([])
  })

  it("requires a current console (a PC-only game is not a boxed present here)", () => {
    expect(onCurrentConsole(["PC", "Mac"])).toBe(false)
    expect(onCurrentConsole(["PC", "Switch 2"])).toBe(true)
  })
})

describe("familyCinemaPicks", () => {
  const m = (id: string, over: Partial<{ inDatabase: boolean; isProvisional: boolean; posterUrl: string | null; expertAgeRec: number | null }>) => ({
    id,
    inDatabase: true,
    isProvisional: false,
    posterUrl: "/p.jpg",
    expertAgeRec: 6,
    ...over,
  })

  it("keeps verified family titles only, in cinema order", () => {
    const picks = familyCinemaPicks(
      [
        m("ok", {}),
        m("provisoire", { isProvisional: true }),
        m("hors-base", { inDatabase: false }),
        m("sans-affiche", { posterUrl: null }),
        m("trop-vieux", { expertAgeRec: 14 }),
        m("sans-age", { expertAgeRec: null }),
        m("ok-tp", { expertAgeRec: 0 }),
      ],
      12,
      10,
    )
    expect(picks.map((p) => p.id)).toEqual(["ok", "ok-tp"])
  })
})

describe("structured data", () => {
  it("lists every card once, in page order, with the year for homonyms", () => {
    const ld = noelItemListJsonLd("Titre", "Desc", "/noel/films-en-famille", [
      { band: NOEL_AGE_BANDS[0], items: [{ id: "a", type: "MOVIE", title: "Klaus", disambiguationYear: null }] },
      { band: NOEL_AGE_BANDS[1], items: [{ id: "b", type: "MOVIE", title: "Scrooge", disambiguationYear: 1970 }] },
    ])
    expect(ld["@type"]).toBe("ItemList")
    expect(ld.numberOfItems).toBe(2)
    expect(ld.itemListElement.map((i) => [i.position, i.name, i.url])).toEqual([
      [1, "Klaus", "https://totemavise.com/media/movie:a"],
      [2, "Scrooge (1970)", "https://totemavise.com/media/movie:b"],
    ])
    // No FAQPage: the age questions belong to the fiches.
    expect(JSON.stringify(ld)).not.toContain("FAQPage")
  })

  it("starts the breadcrumb at the homepage", () => {
    const ld = noelBreadcrumbJsonLd([{ name: "Noël en famille", path: "/noel" }])
    expect(ld.itemListElement.map((i) => i.item)).toEqual(["https://totemavise.com", "https://totemavise.com/noel"])
  })
})

describe("seasonal promotion", () => {
  it("promotes Christmas in November and December only", () => {
    expect(isChristmasSeason(10)).toBe(true)
    expect(isChristmasSeason(11)).toBe(true)
    expect(isChristmasSeason(0)).toBe(false)
    expect(isChristmasSeason(7)).toBe(false)
  })

  it("recognises Christmas titles from the title or the topics", () => {
    expect(isChristmasThemed({ title: "Le Grinch" })).toBe(true)
    expect(isChristmasThemed({ title: "Klaus", topics: ["Noël"] })).toBe(true)
    expect(isChristmasThemed({ title: "Klaus", topics: ["Amitié"] })).toBe(false)
  })

  it("puts the in-season collection in the homepage strip, never an out-of-season one", () => {
    expect(collectionHighlights(10)[1]).toBe("films-noel-famille")
    expect(collectionHighlights(9)[1]).toBe("films-halloween-enfants")
    expect(collectionHighlights(8)[1]).toBe("films-rentree")
    for (let month = 0; month < 12; month++) {
      const ids = collectionHighlights(month)
      expect(ids).toHaveLength(4)
      for (const id of ids) {
        const c = COLLECTIONS.find((x) => x.id === id)
        expect(c, id).toBeDefined()
        if (c?.months) expect(c.months, `${id} en mois ${month}`).toContain(month)
      }
    }
  })
})

describe("sitemap", () => {
  it("lists the hub and every /noel page", () => {
    const urls = staticPageEntries(new Date()).map((e) => new URL(e.url).pathname)
    for (const path of [NOEL_HUB_PATH, ...NOEL_PAGES.map((p) => p.path)]) expect(urls).toContain(path)
  })
})
