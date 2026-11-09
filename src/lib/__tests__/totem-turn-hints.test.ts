import { describe, expect, it } from "vitest"
import {
  ageWindowFor,
  buildHintsNote,
  extractAudienceAges,
  extractRequestedType,
  inferTurnHints,
} from "../totem/turn-hints"

const FAMILY = [
  { name: "Léa", age: 6 },
  { name: "Hugo", age: 10 },
  { name: "Inès", age: 14 },
]

describe("who the request is for", () => {
  it.each([
    ["Un jeu vidéo à faire ensemble avec Hugo et Léa ?", 6, ["Hugo", "Léa"]],
    ["Un film ce soir à la maison avec Hugo et Inès ?", 10, ["Hugo", "Inès"]],
    ["Un film à la maison ce soir pour toute la famille ?", 6, ["Léa", "Hugo", "Inès"]],
    ["Soirée film à la maison pour Inès et sa copine de 15 ans, une idée ?", 14, ["Inès"]],
    ["Un film pour ines", 14, ["Inès"]],
  ])("« %s » → youngest %i", (text, youngest, names) => {
    const h = inferTurnHints({ userText: text, family: FAMILY })
    expect(h.audience?.youngest).toBe(youngest)
    expect(h.audience?.members.map((m) => m.name).sort()).toEqual([...names].sort())
  })

  it("reads ages a parent types, not the age of a title", () => {
    expect(extractAudienceAges("Une soirée film pour nos trois enfants de 10, 13 et 15 ans ?")).toEqual([10, 13, 15])
    expect(extractAudienceAges("On va au cinéma avec nos enfants de 13 et 10 ans")).toEqual([13, 10])
    expect(extractAudienceAges("Un film pour mon fils de 11 ans")).toEqual([11])
    expect(extractAudienceAges("Interstellar est conseillé dès 12 ans ?")).toEqual([])
    expect(extractAudienceAges("un film à partir de 8 ans")).toEqual([])
  })

  it("carries the audience over, and adds a sibling who joins", () => {
    const joined = inferTurnHints({
      priorUserTexts: ["Un film pour Hugo ce soir à la maison ?"],
      userText: "Finalement Léa regarde avec nous.",
      family: FAMILY,
    })
    expect(joined.audience?.members.map((m) => m.name)).toEqual(["Hugo", "Léa"])
    expect(joined.audience?.youngest).toBe(6)
    const another = inferTurnHints({ priorUserTexts: ["Un dessin animé pour Léa ?"], userText: "Un autre ?", family: FAMILY })
    expect(another.audience?.youngest).toBe(6)
    expect(another.requestedType).toBe("SCREEN")
    expect(another.typeStatedNow).toBe(false)
    const switched = inferTurnHints({ priorUserTexts: ["Un film pour Hugo ?"], userText: "Et pour Inès ?", family: FAMILY })
    expect(switched.audience?.members.map((m) => m.name)).toEqual(["Inès"])
  })

  it("drops the carried audience when the parent points at a child without naming them", () => {
    const h = inferTurnHints({
      priorUserTexts: ["Un dessin animé pour Léa ?"],
      userText: "Et pour ma grande, un film ?",
      family: FAMILY,
    })
    expect(h.audience).toBeNull()
    // A title is not a child.
    const title = inferTurnHints({
      priorUserTexts: ["Un dessin animé pour Léa ?"],
      userText: "Et La Petite Sirène, ça irait ?",
      family: FAMILY,
    })
    expect(title.audience?.youngest).toBe(6)
  })

  it("leaves babies out of « toute la famille » and grown-ups unbounded", () => {
    const withBaby = [...FAMILY, { name: "Noé", age: 1 }]
    expect(inferTurnHints({ userText: "Un film pour toute la famille ?", family: withBaby }).audience?.youngest).toBe(6)
    expect(inferTurnHints({ userText: "Un film pour Noé ?", family: withBaby }).audience?.youngest).toBe(1)
    const parents = inferTurnHints({ userText: "Un film pour Marc ?", family: [{ name: "Marc", age: 45 }] }).audience
    expect(ageWindowFor(parents, { maxAge: 16 })).toEqual({ maxAge: 16 })
    expect(buildHintsNote({ audience: parents, requestedType: null, typeStatedNow: false })).toBeNull()
  })
})

describe("the type asked for", () => {
  it.each([
    ["Vous me conseillez un film pour Hugo ce soir ?", "MOVIE"],
    ["Qu'est-ce qui passe au cinéma ?", "MOVIE"],
    ["Une série pour Inès ?", "TV"],
    ["Un jeu vidéo pour Hugo", "GAME"],
    ["un bon livre pour Léa", "BOOK"],
    ["Un dessin animé pour Léa ce soir ?", "SCREEN"],
    ["Un film ou un jeu ?", null],
    ["Interstellar, c'est pour quel âge ?", null],
  ])("« %s » → %s", (text, type) => {
    expect(extractRequestedType(text)).toBe(type)
  })

  it("carries a type over two messages at most, as a default", () => {
    const prior = ["Un film pour Hugo ce soir ?", "Plutôt une comédie."]
    const h = inferTurnHints({ priorUserTexts: prior, userText: "Un autre ?", family: FAMILY })
    expect(h).toMatchObject({ requestedType: "MOVIE", typeStatedNow: false })
    const stale = inferTurnHints({ priorUserTexts: [...prior, "Merci !"], userText: "Un autre ?", family: FAMILY })
    expect(stale.requestedType).toBeNull()
    const now = inferTurnHints({ priorUserTexts: prior, userText: "Et un jeu vidéo ?", family: FAMILY })
    expect(now).toMatchObject({ requestedType: "GAME", typeStatedNow: true })
  })
})

describe("the enforced age window", () => {
  it("caps at the youngest viewer and floors toddler titles out of older groups", () => {
    const hugoInes = inferTurnHints({ userText: "avec Hugo et Inès", family: FAMILY }).audience
    expect(ageWindowFor(hugoInes, {})).toEqual({ minAge: 5, maxAge: 10 })
    // The model passed the oldest child's age: clamped.
    expect(ageWindowFor(hugoInes, { maxAge: 14 })).toEqual({ minAge: 5, maxAge: 10 })
    const lea = inferTurnHints({ userText: "pour Léa", family: FAMILY }).audience
    expect(ageWindowFor(lea, { maxAge: 10 })).toEqual({ maxAge: 6 })
    const teens = inferTurnHints({ userText: "Inès et sa copine de 15 ans", family: FAMILY }).audience
    expect(ageWindowFor(teens, {})).toEqual({ minAge: 9, maxAge: 14 })
    expect(ageWindowFor(null, { maxAge: 12 })).toEqual({ maxAge: 12 })
    // The model asks for less than the floor: the audience changed without a
    // name (« et pour la petite ? »). Its ceiling holds, the floor goes.
    expect(ageWindowFor(teens, { maxAge: 6 })).toEqual({ maxAge: 6 })
  })

  it("tells the model what the tools enforce", () => {
    const note = buildHintsNote(inferTurnHints({ userText: "Un jeu vidéo avec Hugo et Léa ?", family: FAMILY }))!
    expect(note).toContain("Hugo (10 ans)")
    expect(note).toContain("rien au-dessus de 6 ans")
    expect(note).toContain("jeu vidéo")
  })
})
