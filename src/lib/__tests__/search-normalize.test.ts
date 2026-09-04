import { describe, expect, it } from "vitest"
import { compactTitle, escapeLike } from "../search-normalize"

describe("compactTitle", () => {
  it("normalizes French ligatures like Postgres unaccent", () => {
    expect(compactTitle("Mon cœur")).toBe(compactTitle("Mon coeur"))
    expect(compactTitle("Æon Flux")).toBe(compactTitle("Aeon Flux"))
  })
  it("makes a query match a title typed without its leading article", () => {
    // The reported failure: searching "odyssée" for "L'Odyssée".
    expect(compactTitle("odyssée")).toBe("odyssee")
    expect(compactTitle("L'Odyssée")).toBe("odyssee")
    expect(compactTitle("odyssee")).toBe(compactTitle("L'Odyssée"))
  })

  it("strips punctuation entirely, not to a space", () => {
    // Collapsing to a space would leave "spider man", which "%spiderman%"
    // still misses. Verified live: "spiderman" matched 0 rows, "spider-man" 18.
    expect(compactTitle("Spider-Man")).toBe("spiderman")
    expect(compactTitle("spider man")).toBe("spiderman")
    expect(compactTitle("spiderman")).toBe("spiderman")
    expect(compactTitle("S.O.S. Fantômes")).toBe("sosfantomes")
    expect(compactTitle("WALL·E")).toBe("walle")
  })

  it("handles the French articles and their elided forms", () => {
    expect(compactTitle("Le Corniaud")).toBe("corniaud")
    expect(compactTitle("La Boum")).toBe("boum")
    expect(compactTitle("Les Goonies")).toBe("goonies")
    expect(compactTitle("Un Indien dans la ville")).toBe("indiendanslaville")
    expect(compactTitle("The Goonies")).toBe("goonies")
  })

  it("only strips an article at the START", () => {
    // "de l'espace" keeps its article — stripping mid-string would collide
    // unrelated titles.
    // The title starts with "2001", so its "L'" is mid-string and stays put.
    expect(compactTitle("2001 : L'Odyssée de l'espace")).toBe("2001lodysseedelespace")
    // Still CONTAINS the query, so it remains findable — just at the lowest
    // relevance tier, below the film actually called "L'Odyssée".
    expect(compactTitle("2001 : L'Odyssée de l'espace")).toContain("odyssee")
  })

  it("does not strip a word that merely begins with an article's letters", () => {
    expect(compactTitle("Lassie")).toBe("lassie")
    expect(compactTitle("Angel")).toBe("angel")
    expect(compactTitle("Une vie")).toBe("vie")
  })

  it("yields empty for input with nothing alphanumeric", () => {
    expect(compactTitle("!!!")).toBe("")
    expect(compactTitle("   ")).toBe("")
  })

  it("cannot smuggle LIKE wildcards (they are non-alphanumeric)", () => {
    expect(compactTitle("%_%")).toBe("")
    expect(compactTitle("a%b_c")).toBe("abc")
  })
})

describe("relevance tiers (as applied in SQL)", () => {
  // Mirrors the CASE in relevanceOrderSql so the intent is pinned in TS.
  const tier = (title: string, query: string): number => {
    const t = compactTitle(title)
    const q = compactTitle(query)
    if (t === q) return 0
    if (t.startsWith(q)) return 1
    return 2
  }

  it("ranks the exact work above longer titles containing it", () => {
    // The live bug: "L'Odyssée" (2026) came 6th of 6, behind 2001 and Narnia,
    // purely because it had 0 votes.
    expect(tier("L'Odyssée", "odyssée")).toBe(0)
    expect(tier("2001 : L'Odyssée de l'espace", "odyssée")).toBe(2)
    expect(tier("Le Monde de Narnia : L'Odyssée du passeur d'aurore", "odyssée")).toBe(2)
  })

  it("ranks a sequel as a prefix match, above an unrelated containing title", () => {
    expect(tier("Spider-Man", "spider man")).toBe(0)
    expect(tier("Spider-Man: Brand New Day", "spider man")).toBe(1)
    expect(tier("The Amazing Spider-Man", "spider man")).toBe(2)
    expect(tier("Les chroniques de Spiderwick", "spiderman")).toBe(2)
  })
})

describe("escapeLike", () => {
  it("neutralises LIKE wildcards for the fallback path", () => {
    expect(escapeLike("100%")).toBe("100\\%")
    expect(escapeLike("a_b")).toBe("a\\_b")
    expect(escapeLike("back\\slash")).toBe("back\\\\slash")
  })
})
