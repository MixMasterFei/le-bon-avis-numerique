import { describe, expect, it } from "vitest"
import type { ModelMessage } from "ai"
import { buildShownNote, collectShownMedia, saysAlreadySeen } from "../totem/shown"
import { buildTrustedHistory, type StoredTurnRow } from "../totem/history"

const item = (id: string, title: string) => ({ id, title, recommendedAge: 6 })

function exchange(tool: string, results: unknown, text: string, id = "c1"): ModelMessage[] {
  return [
    {
      role: "assistant",
      content: [{ type: "tool-call", toolCallId: id, toolName: tool, input: {} }],
    },
    {
      role: "tool",
      content: [{ type: "tool-result", toolCallId: id, toolName: tool, output: { type: "json", value: results as never } }],
    },
    { role: "assistant", content: [{ type: "text", text }] },
  ]
}

describe("what the parent was shown", () => {
  it("takes the displayed cards, and the titles named in the answer", () => {
    const rail = exchange(
      "getDiscoveryRail",
      {
        status: "ok",
        results: ["Piper", "Winnie", "Knick Knack", "Coco", "Vaiana", "Zootopie", "Ponyo", "Totoro"].map((t, i) =>
          item(`m-${i}`, t),
        ),
      },
      "Piper ou Winnie ce soir. Sinon Mon voisin Totoro, ou Up.",
    )
    const search = exchange(
      "searchMedia",
      { results: ["Le Bonhomme de neige", "Paddington", "Ernest et Célestine", "Kirikou", "Up"].map((t, i) => item(`s-${i}`, t)) },
      "",
      "c2",
    )
    const shown = collectShownMedia([...rail, ...search]).map((s) => s.title)
    // 6 rail cards + 4 search cards; « Ponyo » was returned but never shown
    // nor named; « Totoro » was returned off-card but named; « Up » is too
    // short to be matched by name.
    expect(shown).toEqual(expect.arrayContaining(["Piper", "Zootopie", "Le Bonhomme de neige", "Kirikou", "Totoro"]))
    expect(shown).not.toContain("Ponyo")
    expect(shown).not.toContain("Up")
    expect(shown).toHaveLength(11)
  })

  it("counts a details card, and ignores a refused rail", () => {
    const details = exchange("getMediaDetails", { found: true, id: "m-pad", title: "Paddington" }, "")
    const refused = exchange("getDiscoveryRail", { status: "type_mismatch", results: [] }, "", "c2")
    expect(collectShownMedia([...details, ...refused])).toEqual([{ id: "m-pad", title: "Paddington" }])
  })

  it("covers the whole conversation, not only the exchanges kept for the model", () => {
    const rows: StoredTurnRow[] = []
    for (let i = 0; i < 9; i++) {
      rows.push({ role: "user", content: `Un autre ? (${i})` })
      rows.push({
        role: "assistant",
        content: "",
        modelMessages: exchange("searchMedia", { results: [item(`m-${i}`, `Titre numéro ${i}`)] }, "", `c${i}`),
      })
    }
    const h = buildTrustedHistory({ rows, userText: "Encore un autre ?" })
    expect(h.exchangesDropped).toBeGreaterThan(0)
    expect(h.shownMedia.map((s) => s.id)).toEqual(rows.filter((r) => r.role === "assistant").map((_, i) => `m-${i}`))
  })

  it("drops an answer replaced by « Réessayer »", () => {
    const rows: StoredTurnRow[] = [
      { role: "user", content: "Un film pour Léa ?" },
      { role: "assistant", content: "", modelMessages: exchange("searchMedia", { results: [item("m-1", "Piper")] }, "") },
      { role: "user", content: "Un film pour Léa ?", finishReason: "regenerate" },
      { role: "assistant", content: "", modelMessages: exchange("searchMedia", { results: [item("m-2", "Coco")] }, "") },
    ]
    expect(buildTrustedHistory({ rows, userText: "Un autre ?" }).shownMedia).toEqual([{ id: "m-2", title: "Coco" }])
  })
})

describe("« déjà vu » in the chat", () => {
  it.each([
    ["Elle les a déjà vus.", true],
    ["On l'a vu la semaine dernière", true],
    ["Ils les ont déjà regardés", true],
    ["Hugo connaît déjà", true],
    ["Elle a vu la bande-annonce et elle a eu peur", false],
    ["Il ne l'a pas encore vu", false],
    ["Un autre ?", false],
  ])("« %s » → %s", (text, expected) => {
    expect(saysAlreadySeen(text)).toBe(expected)
  })

  it("asks Totem to offer recording them, not to send the parent to a button", () => {
    const note = buildShownNote({ shown: [{ id: "m-1", title: "Piper" }], alreadySeen: true, userIsAnonymous: false })!
    expect(note).toContain("Piper")
    expect(note).toContain("proposeReaction")
    expect(note).toContain("WATCHED")
    expect(note).toMatch(/Ne lui demande pas d'aller toucher un bouton/)
    const anonymous = buildShownNote({ shown: [], alreadySeen: true, userIsAnonymous: true })!
    expect(anonymous).not.toContain("proposeReaction")
    expect(buildShownNote({ shown: [], alreadySeen: false, userIsAnonymous: false })).toBeNull()
  })
})
