import { describe, expect, it } from "vitest"
import { extractCatalogMatches, extractCatalogMatchesFromStory, type LinkableMedia } from "@/lib/news-linkify"

function media(id: string, title: string): LinkableMedia {
  return {
    id,
    title,
    originalTitle: null,
    type: "MOVIE",
    releaseYear: null,
    expertAgeRec: null,
  }
}

function mediaWithOriginal(id: string, title: string, originalTitle: string): LinkableMedia {
  return {
    ...media(id, title),
    originalTitle,
  }
}

describe("extractCatalogMatches", () => {
  it("does not link common prose words that happen to be catalog titles", () => {
    const catalog = [
      media("elles", "Elles"),
      media("phenomene", "Phénomène"),
    ]

    const body = [
      "Elles souhaitent anticiper l'éclipse solaire du 12 août 2026.",
      "Une carte interactive permet de visualiser l'apparence du phénomène en France.",
    ].join(" ")

    expect(extractCatalogMatches(body, catalog)).toEqual([])
  })

  it("keeps clear media-title mentions", () => {
    const catalog = [
      media("minecraft", "Minecraft"),
      media("vice-versa-2", "Vice-Versa 2"),
    ]

    expect(
      extractCatalogMatches(
        "Minecraft arrive au cinéma, pendant que le film Vice-Versa 2 reste dans les discussions familiales.",
        catalog,
      ),
    ).toEqual(["minecraft", "vice-versa-2"])
  })

  it("keeps an ambiguous title when the story is clearly about that film", () => {
    const catalog = [media("elle-film", "Elle")]

    expect(
      extractCatalogMatchesFromStory(
        {
          title: "Le film Elle ressort au cinéma",
          summary: "Le long-métrage de Paul Verhoeven revient en salles.",
          body: "Cette ressortie du film Elle donne aux parents des repères de contexte.",
        },
        catalog,
      ),
    ).toEqual(["elle-film"])
  })

  it("adds Middle-earth franchise candidates for the Lord of the Rings anniversary story", () => {
    const catalog = [
      mediaWithOriginal("fellowship", "The Lord of the Rings: The Fellowship of the Ring", "Le Seigneur des Anneaux : La Communauté de l'Anneau"),
      mediaWithOriginal("two-towers", "The Lord of the Rings: The Two Towers", "Le Seigneur des Anneaux : Les Deux Tours"),
      mediaWithOriginal("return-king", "The Lord of the Rings: The Return of the King", "Le Seigneur des Anneaux : Le Retour du roi"),
      mediaWithOriginal("hobbit", "The Hobbit: An Unexpected Journey", "Le Hobbit : Un voyage inattendu"),
      mediaWithOriginal("rings-power", "The Lord of the Rings: The Rings of Power", "Le Seigneur des Anneaux : Les Anneaux de Pouvoir"),
      media("unrelated", "Elles"),
    ]

    const ids = extractCatalogMatchesFromStory(
      {
        title: "Le film Le Seigneur des Anneaux : La Communauté de l'Anneau a 25 ans",
        summary: "L'anniversaire remet en lumière l'adaptation de Tolkien et la saga au cinéma.",
        body: "La Communauté de l'Anneau reste le point d'entrée vers la trilogie. L'article revient sur l'héritage de la Terre du Milieu, des salles au streaming familial.",
      },
      catalog,
      8,
      [
        "Le Seigneur des Anneaux",
        "The Lord of the Rings",
        "La Communauté de l'Anneau",
        "The Fellowship of the Ring",
        "Les Deux Tours",
        "The Two Towers",
        "Le Retour du roi",
        "The Return of the King",
        "Le Hobbit",
        "The Hobbit",
        "Les Anneaux de Pouvoir",
        "The Rings of Power",
      ],
    )

    expect(ids).toContain("fellowship")
    expect(ids).toContain("two-towers")
    expect(ids).toContain("return-king")
    expect(ids).toContain("hobbit")
    expect(ids).toContain("rings-power")
    expect(ids).not.toContain("unrelated")
  })

  it("adds Star Fox game candidates for a news story about the franchise", () => {
    const catalog = [
      media("star-fox-64", "Star Fox 64"),
      media("star-fox-zero", "Star Fox Zero"),
      media("unrelated", "Fox"),
    ]

    const ids = extractCatalogMatchesFromStory(
      {
        title: "Star Fox revient sur Switch 2, 29 ans après la N64",
        summary: "Nintendo remet la saga spatiale en avant sur sa nouvelle console.",
        body: "Le jeu culte de la Nintendo 64 revient dans l'actualité familiale avec une nouvelle mise en avant.",
      },
      catalog,
      8,
      ["Star Fox"],
    )

    expect(ids).toContain("star-fox-64")
    expect(ids).toContain("star-fox-zero")
    expect(ids).not.toContain("unrelated")
  })
})
