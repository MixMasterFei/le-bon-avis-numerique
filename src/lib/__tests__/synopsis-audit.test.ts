import { describe, expect, it } from "vitest"
import { buildAuditPrompt, parseAuditResponse, correctionPasses, type AuditItemInput } from "../synopsis-audit"

// Real defect pulled from prod: the enrichment pass dropped "des" before a
// plural noun, and the same pattern recurred on other titles in the catalog.
const HP_ORIGINAL =
  "Un garçon orphelin maltraité découvre à 11 ans qu'il est sorcier et intègre une école de magie où il se fait des amis, apprend et doit faire face à mystères qui bouleversent son quotidien."

describe("buildAuditPrompt", () => {
  it("includes every item's id, title and synopsis, in order", () => {
    const items: AuditItemInput[] = [
      { id: "id-1", title: "Harry Potter à l'école des sorciers", type: "MOVIE", synopsis: HP_ORIGINAL },
      { id: "id-2", title: "Un jeu", type: "GAME", synopsis: "Un synopsis de test suffisamment long." },
    ]
    const prompt = buildAuditPrompt(items)
    expect(prompt.indexOf("id-1")).toBeLessThan(prompt.indexOf("id-2"))
    expect(prompt).toContain("Harry Potter à l'école des sorciers")
    expect(prompt).toContain(HP_ORIGINAL)
    expect(prompt).toContain("Un jeu")
  })
})

describe("parseAuditResponse", () => {
  const ids = ["id-1", "id-2"]

  it("parses a clean JSON array", () => {
    const raw = JSON.stringify([
      { id: "id-1", hasIssue: true, issueType: "grammar", corrected: "Une version corrigée assez longue pour passer." },
      { id: "id-2", hasIssue: false, issueType: null, corrected: null },
    ])
    const verdicts = parseAuditResponse(raw, ids)
    expect(verdicts).toHaveLength(2)
    expect(verdicts[0]).toMatchObject({ id: "id-1", hasIssue: true, issueType: "grammar" })
    expect(verdicts[1]).toMatchObject({ id: "id-2", hasIssue: false, corrected: null })
  })

  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([{ id: "id-1", hasIssue: false }]) + "\n```"
    const verdicts = parseAuditResponse(raw, ids)
    expect(verdicts).toHaveLength(1)
  })

  it("drops entries with an unknown id", () => {
    const raw = JSON.stringify([{ id: "not-in-batch", hasIssue: true, corrected: "Texte assez long pour être plausible ici." }])
    expect(parseAuditResponse(raw, ids)).toHaveLength(0)
  })

  it("treats hasIssue=true with a missing/too-short correction as flag-only (corrected:null)", () => {
    const raw = JSON.stringify([{ id: "id-1", hasIssue: true, issueType: "style", corrected: "trop court" }])
    const verdicts = parseAuditResponse(raw, ids)
    expect(verdicts[0].hasIssue).toBe(true)
    expect(verdicts[0].corrected).toBeNull()
  })

  it("returns an empty array for unparseable content", () => {
    expect(parseAuditResponse("not json at all", ids)).toEqual([])
  })
})

describe("correctionPasses", () => {
  it("accepts a grammar fix that keeps the same facts and a similar length", () => {
    const fixed =
      "Un garçon orphelin maltraité découvre à 11 ans qu'il est sorcier et intègre une école de magie où il se fait des amis, apprend la magie et doit affronter des mystères qui bouleversent son quotidien."
    expect(correctionPasses(HP_ORIGINAL, fixed)).toBe(true)
  })

  it("accepts a naturalness rewrite that changes many words but preserves anchors + length", () => {
    // Simulates a "stop sounding like an AI" pass: different phrasing
    // throughout, but the same names/numbers and roughly the same length.
    const original = "Un jeune héros nommé Kael doit sauver le royaume de Lumenia à l'âge de 14 ans."
    const rewritten = "À 14 ans, le jeune Kael part sauver le royaume de Lumenia, menacé par les ténèbres."
    expect(correctionPasses(original, rewritten)).toBe(true)
  })

  it("rejects a correction that drops a named anchor", () => {
    const original = "Harry affronte Voldemort à Poudlard lors d'un duel décisif."
    const corrected = "Le héros affronte son ennemi dans une école de magie lors d'un duel décisif."
    expect(correctionPasses(original, corrected)).toBe(false)
  })

  it("rejects a correction that is wildly longer or shorter", () => {
    const original = "Un garçon découvre à 11 ans qu'il est sorcier et rejoint une école de magie."
    const tooShort = "Un sorcier à l'école."
    const tooLong =
      original + " " + "Il y vit d'innombrables aventures, se fait de nombreux amis, affronte des dangers, découvre des secrets, et grandit énormément au fil de cette longue et riche première année scolaire pleine de rebondissements."
    expect(correctionPasses(original, tooShort)).toBe(false)
    expect(correctionPasses(original, tooLong)).toBe(false)
  })

  it("rejects a no-op (identical) correction", () => {
    expect(correctionPasses(HP_ORIGINAL, HP_ORIGINAL)).toBe(false)
  })

  it("rejects a null correction", () => {
    expect(correctionPasses(HP_ORIGINAL, null)).toBe(false)
  })
})
