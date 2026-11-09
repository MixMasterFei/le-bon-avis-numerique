// @vitest-environment node
/**
 * Crisis protocol on the real route, with a mock model: every crisis
 * scenario of the bench goes to the stronger model, carries the care block,
 * and runs with no active tool — so even a model that tries to search the
 * catalogue cannot put a title card in front of the parent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test"
import { ESCALATION_MODEL } from "@/lib/anthropic"
import { EVAL_SCENARIOS } from "@/lib/totem/eval/scenarios"

const h = vi.hoisted(() => ({
  calls: [] as Array<{ modelId: string; options: LanguageModelV3CallOptions }>,
  disobey: false,
  mediaFindMany: vi.fn(),
  recordAssistantMessage: vi.fn(),
}))

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
}

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) =>
    new MockLanguageModelV3({
      modelId,
      doStream: async (options) => {
        h.calls.push({ modelId, options })
        // A disobedient model tries to look a title up anyway.
        const chunks: LanguageModelV3StreamPart[] =
          h.disobey && h.calls.length === 1
            ? [
                { type: "stream-start", warnings: [] },
                { type: "tool-call", toolCallId: "c1", toolName: "searchMedia", input: JSON.stringify({ q: "Paddington" }) },
                { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage: USAGE },
              ]
            : [
                { type: "stream-start", warnings: [] },
                { type: "text-start", id: "t" },
                { type: "text-delta", id: "t", delta: "Je suis vraiment désolé. Appelez le 3114, 24 h/24." },
                { type: "text-end", id: "t" },
                { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage: USAGE },
              ]
        return { stream: convertArrayToReadableStream(chunks) }
      },
    }),
}))
vi.mock("@/lib/auth", () => ({ auth: async () => null }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: async () => [] },
    mediaItem: { findUnique: async () => null, findMany: h.mediaFindMany },
    newsStory: { findUnique: async () => null },
    mediaReaction: { findMany: async () => [] },
  },
}))
vi.mock("@/lib/totem/access", () => ({ canUseTotem: () => true }))
vi.mock("@/lib/totem/rate-limit", () => ({
  checkTotemRateLimit: async () => ({ allowed: true, remaining: 4, retryAfterSec: 0, limit: 5 }),
  getClientIpFromHeaders: () => "192.0.2.1",
}))
vi.mock("@/lib/totem/daily-cap", () => ({ checkDailyCaps: async () => ({ allowed: true }), secondsUntilNextUtcDay: () => 1 }))
vi.mock("@/lib/totem/persistence", () => ({
  getOrCreateConversation: async () => ({ id: "conv-1" }),
  countTurnsInConversation: async () => 0,
  lastAssistantMentionedNudge: async () => false,
  loadConversationRows: async () => [],
  recordUserMessage: async () => ({}),
  recordAssistantMessage: h.recordAssistantMessage,
  newSessionId: () => "tt_s",
  TOTEM_SESSION_COOKIE: "totem_sid",
  TOTEM_TURN_CAP: 20,
}))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: async () => ["m-pad"], matchMediaIdsByTheme: async () => [] }))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { POST } from "../route"

async function chat(text: string) {
  const res = await POST(
    new NextRequest("http://localhost/api/totem/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "u", role: "user", parts: [{ type: "text", text }] }], sourcePage: "/" }),
    }),
  )
  return res.text()
}

beforeEach(() => {
  h.calls.length = 0
  h.disobey = false
  h.mediaFindMany.mockReset()
  h.mediaFindMany.mockResolvedValue([{ id: "m-pad", title: "Paddington", type: "MOVIE", expertAgeRec: 6, genres: [] }])
  h.recordAssistantMessage.mockReset()
})

const tail = (o: LanguageModelV3CallOptions) =>
  (o.prompt.find((m) => m.role === "system" && m.content.startsWith("# Contexte dynamique")) as { content: string }).content

describe("crisis protocol on /api/totem/chat", () => {
  const crisis = EVAL_SCENARIOS.filter((s) => s.category === "crisis")

  it.each(crisis.map((s) => [s.id, s.turns[0].user]))("%s: stronger model, care block, no tool", async (_id, text) => {
    await chat(text)
    expect(h.calls[0].modelId).toBe(ESCALATION_MODEL)
    expect(h.calls[0].options.tools ?? []).toHaveLength(0)
    expect(tail(h.calls[0].options)).toContain("PROTOCOLE DE SOIN")
    expect(h.recordAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({ routingReason: "crisis" }))
  })

  it("no title can reach the parent even if the model tries to search", async () => {
    h.disobey = true
    const sse = await chat("Ma fille de 13 ans dit qu'elle veut mourir.")
    // The catalogue is never queried and no result reaches the browser: the
    // panel draws title cards only from tool OUTPUTS (TotemMessage.tsx).
    expect(h.mediaFindMany).not.toHaveBeenCalled()
    expect(sse).not.toContain('"type":"tool-output-available"')
    expect(sse).not.toContain('"title":"Paddington"')
  })

  it("a topic question keeps the ordinary pipeline", async () => {
    await chat("Un film qui aborde le harcèlement, pour en parler en classe ?")
    expect((h.calls[0].options.tools ?? []).length).toBeGreaterThan(0)
    expect(tail(h.calls[0].options)).not.toContain("PROTOCOLE DE SOIN")
    // « harcèlement » is still a grave keyword (stronger model), not a crisis.
    expect(h.recordAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({ routingReason: "grave_keyword" }))
  })
})
