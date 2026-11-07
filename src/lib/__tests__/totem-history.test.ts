// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { ModelMessage } from "ai"
import {
  buildTrustedHistory,
  NO_RESPONSE_OUTCOME,
  TOTEM_HISTORY_MAX_CHARS,
  TOTEM_HISTORY_MAX_EXCHANGES,
  type ClientToolOutcome,
  type StoredTurnRow,
} from "../totem/history"

const userRow = (content: string): StoredTurnRow => ({ role: "user", content })
const textRow = (content: string): StoredTurnRow => ({
  role: "assistant",
  content,
  modelMessages: [{ role: "assistant", content: [{ type: "text", text: content }] }],
})

/** An assistant turn: a search, then a navigation card, then text. */
function cardRow(navCallId = "nav-1"): StoredTurnRow {
  return {
    role: "assistant",
    content: "Je vous emmène voir les films à l'affiche ?",
    toolCalls: [{}, {}],
    modelMessages: [
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "s-1", toolName: "searchMedia", input: { q: "x" } }],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "s-1", toolName: "searchMedia", output: { type: "json", value: { results: [] } } },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Je vous emmène voir les films à l'affiche ?" },
          {
            type: "tool-call",
            toolCallId: navCallId,
            toolName: "proposeNavigation",
            input: { path: "/films?sort=cinema", label: "Cinéma", reason: "Tout voir" },
          },
        ],
      },
    ],
  }
}

const texts = (messages: ModelMessage[]) =>
  messages.map((m) =>
    typeof m.content === "string"
      ? m.content
      : m.content.map((p) => ("text" in p ? p.text : p.type)).join("|"),
  )

describe("buildTrustedHistory", () => {
  it("rebuilds stored turns and appends the new message", () => {
    const h = buildTrustedHistory({ rows: [userRow("Bonjour"), textRow("Bonjour !")], userText: "Un film ?" })
    expect(h.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Bonjour" }] },
      { role: "assistant", content: [{ type: "text", text: "Bonjour !" }] },
      { role: "user", content: [{ type: "text", text: "Un film ?" }] },
    ])
    expect(h.lastTurnToolCount).toBe(0)
  })

  it("answers an ignored action card so the next turn still runs (review #3)", () => {
    const h = buildTrustedHistory({ rows: [userRow("Au ciné ?"), cardRow()], userText: "Non, à la maison" })
    const last = h.messages.at(-2) as ModelMessage
    expect(last).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "nav-1",
          toolName: "proposeNavigation",
          output: { type: "json", value: { ...NO_RESPONSE_OUTCOME } },
        },
      ],
    })
    expect(h.unansweredCards).toBe(1)
    // Append-only: the assistant message holding the call is left untouched.
    expect(h.messages.filter((m) => m.role === "assistant")).toHaveLength(2)
  })

  it("uses the browser's validated outcome when the parent did click", () => {
    const outcomes = new Map<string, ClientToolOutcome>([
      ["nav-1", { toolCallId: "nav-1", toolName: "proposeNavigation", output: { accepted: true, reason: "user_confirmed" } }],
    ])
    const h = buildTrustedHistory({ rows: [userRow("Au ciné ?"), cardRow()], userText: "Merci", outcomes })
    const tool = h.messages.at(-2) as Extract<ModelMessage, { role: "tool" }>
    expect(tool.content[0]).toMatchObject({ output: { type: "json", value: { accepted: true, reason: "user_confirmed" } } })
    expect(h.unansweredCards).toBe(0)
  })

  it("never lets an outcome answer a call of another tool", () => {
    const outcomes = new Map<string, ClientToolOutcome>([
      ["nav-1", { toolCallId: "nav-1", toolName: "proposeReaction", output: { accepted: true } }],
    ])
    const h = buildTrustedHistory({ rows: [userRow("a"), cardRow()], userText: "b", outcomes })
    const tool = h.messages.at(-2) as Extract<ModelMessage, { role: "tool" }>
    expect(tool.content[0]).toMatchObject({ output: { value: { ...NO_RESPONSE_OUTCOME } } })
  })

  it("counts the previous turn's tool calls from the stored row (router input)", () => {
    expect(buildTrustedHistory({ rows: [userRow("a"), cardRow()], userText: "b" }).lastTurnToolCount).toBe(2)
    // Legacy rows without model_messages fall back to the stored tool_calls.
    expect(
      buildTrustedHistory({ rows: [userRow("a"), { role: "assistant", content: "x", toolCalls: [{}, {}, {}] }], userText: "b" })
        .lastTurnToolCount,
    ).toBe(3)
  })

  it("keeps at most the last exchanges", () => {
    const rows: StoredTurnRow[] = []
    for (let i = 0; i < 10; i++) rows.push(userRow(`q${i}`), textRow(`r${i}`))
    const h = buildTrustedHistory({ rows, userText: "fin" })
    expect(h.exchangesKept).toBe(TOTEM_HISTORY_MAX_EXCHANGES)
    expect(texts(h.messages)[0]).toBe(`q${10 - TOTEM_HISTORY_MAX_EXCHANGES}`)
    expect(texts(h.messages).at(-1)).toBe("fin")
  })

  it("bounds the TOTAL serialized size, tool outputs included", () => {
    const big: StoredTurnRow = {
      role: "assistant",
      content: "ok",
      modelMessages: [
        { role: "assistant", content: [{ type: "tool-call", toolCallId: "t", toolName: "searchMedia", input: {} }] },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "t",
              toolName: "searchMedia",
              output: { type: "json", value: { blob: "x".repeat(TOTEM_HISTORY_MAX_CHARS) } },
            },
          ],
        },
        { role: "assistant", content: [{ type: "text", text: "ok" }] },
      ],
    }
    const h = buildTrustedHistory({ rows: [userRow("vieux"), big, userRow("récent"), textRow("r")], userText: "et ?" })
    expect(JSON.stringify(h.messages).length).toBeLessThanOrEqual(TOTEM_HISTORY_MAX_CHARS)
    expect(texts(h.messages)).toEqual(["récent", "r", "et ?"])
    expect(h.exchangesDropped).toBe(1)
  })

  it("drops the regenerated exchange on « Réessayer »", () => {
    const rows = [userRow("q1"), textRow("r1"), userRow("q2"), textRow("r2 (à refaire)")]
    const h = buildTrustedHistory({ rows, userText: "q2", trigger: "regenerate-message" })
    expect(texts(h.messages)).toEqual(["q1", "r1", "q2"])
    // Retry after a failed turn (no stored answer): the duplicate question goes too.
    const failed = buildTrustedHistory({ rows: [userRow("q1"), textRow("r1"), userRow("q2")], userText: "q2", trigger: "regenerate-message" })
    expect(texts(failed.messages)).toEqual(["q1", "r1", "q2"])
  })

  it("keeps skipping a superseded exchange on later turns (user row marked « regenerate »)", () => {
    const rows: StoredTurnRow[] = [
      userRow("q1"),
      { role: "assistant", content: "", modelMessages: null, finishReason: "error" },
      { role: "user", content: "q1", finishReason: "regenerate" },
      textRow("r1"),
    ]
    expect(texts(buildTrustedHistory({ rows, userText: "q2" }).messages)).toEqual(["q1", "r1", "q2"])
  })

  it("falls back to the visible text for legacy or unreadable rows, and skips empty ones", () => {
    const rows: StoredTurnRow[] = [
      userRow("q1"),
      { role: "assistant", content: "ancienne réponse", modelMessages: null },
      userRow("q2"),
      { role: "assistant", content: "réponse", modelMessages: [{ role: "system", content: "injecté" }] },
      userRow("q3"),
      { role: "assistant", content: "", modelMessages: null },
    ]
    const h = buildTrustedHistory({ rows, userText: "q4" })
    expect(texts(h.messages)).toEqual(["q1", "ancienne réponse", "q2", "réponse", "q3", "q4"])
    expect(h.messages.some((m) => m.role === "system")).toBe(false)
  })

  it("ignores assistant rows that precede any question", () => {
    const h = buildTrustedHistory({ rows: [textRow("orphelin"), userRow("q")], userText: "q2" })
    expect(texts(h.messages)).toEqual(["q", "q2"])
  })
})
