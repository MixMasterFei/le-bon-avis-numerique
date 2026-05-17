import { describe, expect, it } from "vitest"
import { deriveNewsImageConcept } from "../news-image-concepts"

const SENSITIVE_TERMS = [
  "netflix",
  "disney",
  "tiktok",
  "instagram",
  "chatgpt",
  "openai",
  "google",
  "nintendo",
  "roblox",
  "minecraft",
]

describe("news image concepts", () => {
  it("maps streaming brands to generic legal stock concepts", () => {
    const concept = deriveNewsImageConcept({
      title: "Netflix et Disney+ changent leurs offres pour les familles",
      category: "FILM_TV",
    })

    expect(concept.query).toBe("family watching streaming service television")
    expect(concept.label).toBe("streaming familial")
    for (const term of SENSITIVE_TERMS) {
      expect(concept.query.toLowerCase()).not.toContain(term)
    }
  })

  it("does not send social, AI, or game brands as raw stock queries", () => {
    const titles = [
      "TikTok renforce ses controles parentaux",
      "ChatGPT arrive dans de nouvelles salles de classe",
      "Nintendo et Roblox au coeur des usages des enfants",
      "Google impose un numero de telephone pour certains comptes",
    ]

    for (const title of titles) {
      const concept = deriveNewsImageConcept({ title, category: "TECH" })
      for (const term of SENSITIVE_TERMS) {
        expect(concept.query.toLowerCase()).not.toContain(term)
      }
    }
  })

  it("maps ambiguous French headlines to editorial concepts instead of literal words", () => {
    const cases = [
      {
        title: "Été du Canal 2026 : plages et activités à Paris cet été",
        summary: "Des plages éphémères et activités nautiques reviennent à Paris et en Île-de-France.",
        category: "PARENTHOOD",
        query: "families summer outdoor activities park",
      },
      {
        title: "BBC publie un guide de survie pour les examens destiné aux élèves et à leurs familles",
        category: "PARENTHOOD",
        query: "students studying exam desk books",
      },
      {
        title: "Classe investigation : un jeu pédagogique sur le trafic en Amazonie",
        category: "TECH",
        query: "students laptop classroom media literacy",
      },
      {
        title: "Couvre-feu pour mineurs : une mesure contestée face au narcotrafic",
        category: "PARENTHOOD",
        query: "empty urban street night police lights",
      },
    ]

    for (const item of cases) {
      expect(deriveNewsImageConcept(item).query).toBe(item.query)
    }
  })
})
