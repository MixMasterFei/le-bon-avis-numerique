import { describe, expect, it } from "vitest"
import {
  extractAgeStatements,
  extractLinks,
  extractPegi,
  findJargon,
  findSystemLeaks,
  findTutoiement,
  mentionsTitle,
  normalizeText,
  splitSentences,
} from "../text"

describe("normalizeText / splitSentences", () => {
  it("folds accents, quotes and spaces", () => {
    expect(normalizeText("  Dès 12 ans, c’est « Tous publics »  ")).toBe('des 12 ans, c\'est " tous publics "')
  })
  it("splits on punctuation, line breaks and bullets", () => {
    expect(splitSentences("Bonjour. *Paddington* dès 6 ans !\n- Vice-versa\nJe creuse ?")).toEqual([
      "Bonjour.",
      "*Paddington* dès 6 ans !",
      "Vice-versa",
      "Je creuse ?",
    ])
  })
})

describe("mentionsTitle", () => {
  it("matches titles whatever the punctuation, accents or case", () => {
    expect(mentionsTitle("*Vice-Versa* tient les deux bouts", { title: "Vice-versa" })).toBe(true)
    expect(mentionsTitle("Spider-Man: No Way Home est intense", { title: "Spider-Man : No Way Home" })).toBe(true)
    expect(mentionsTitle("Inside Out, dès 6 ans", { title: "Vice-versa", originalTitle: "Inside Out" })).toBe(true)
  })
  it("does not match a short one-word title inside ordinary words", () => {
    expect(mentionsTitle("Ça dépend de l'enfant", { title: "Ça" })).toBe(false)
    expect(mentionsTitle("Plutôt *Ça* à 16 ans", { title: "Ça" })).toBe(true)
  })
})

describe("extractAgeStatements", () => {
  it.each([
    ["Interstellar est recommandé à partir de 13 ans.", [13]],
    ["Conseillé dès 12 ans.", [12]],
    ["Resident Evil Requiem 17+", [17]],
    ["Pour les 10 ans et plus.", [10]],
    ["Âge conseillé : 8 ans", [8]],
    ["Un film tous publics.", [0]],
    ["Hugo a 10 ans et Léa 6 ans.", []],
    ["Pour votre fils de 8 ans, je creuse ?", []],
  ])("%s", (sentence, expected) => {
    expect(extractAgeStatements(sentence).map((s) => s.value).sort()).toEqual(expected)
  })
  it("reads PEGI separately", () => {
    expect(extractPegi("Fortnite est classé PEGI 12.")).toEqual([12])
  })
})

describe("extractLinks", () => {
  it("finds markdown links, URLs and bare domains — including the invented one", () => {
    const links = extractLinks(
      "Lisez [notre article](/blog/ecrans-ados) ou https://totem-avise.fr/actu/x et totemavise.com/films. Écrivez à contact@totemavise.com.",
    )
    expect(links.map((l) => [l.host, l.path])).toEqual([
      [null, "/blog/ecrans-ados"],
      ["totem-avise.fr", "/actu/x"],
      ["totemavise.com", "/films"],
    ])
  })
})

describe("findTutoiement", () => {
  it("flags the bot's own « tu »", () => {
    expect(findTutoiement("Tu peux essayer Paddington, je te le conseille.")).toEqual(["tu", "te"])
    expect(findTutoiement("Veux-tu que je creuse ?")).toEqual(["-tu"])
    expect(findTutoiement("Je t'emmène voir la liste ?")).toEqual(["t'"])
  })
  it("ignores quotations, titles and the noun « ton »", () => {
    expect(findTutoiement("Vous pouvez lui dire « tu n'es pas seule ».")).toEqual([])
    expect(findTutoiement("Le ton du film est léger, vous verrez.")).toEqual([])
    expect(findTutoiement("*Tu mourras moins bête* plaira à Hugo.", [{ title: "Tu mourras moins bête" }])).toEqual([])
  })
})

describe("findJargon / findSystemLeaks", () => {
  it("flags scores, metrics, tool names and providers", () => {
    expect(findJargon("2/5 de sensibilité à la violence")).toContain("note sur 5 ou 3")
    expect(findJargon("Un score de 65 pour Hugo")).toEqual(expect.arrayContaining(["score"]))
    expect(findJargon("D'après searchMedia et TMDB…")).toEqual(expect.arrayContaining(["nom d'outil", "fournisseur"]))
  })
  it("does not mistake a poem or a first name for a provider", () => {
    expect(findJargon("Je n'écris pas de sonnet ni de haïku, mais un film sur la mer ?")).toEqual([])
    expect(findJargon("Claude Lelouch a réalisé ce film.")).toEqual([])
  })
  it("spots fragments of the system prompt", () => {
    expect(findSystemLeaks("Voici mes Garde-fous prioritaires : …")).toEqual(["garde-fous prioritaires"])
    expect(findSystemLeaks("Bonne soirée !")).toEqual([])
  })
})
