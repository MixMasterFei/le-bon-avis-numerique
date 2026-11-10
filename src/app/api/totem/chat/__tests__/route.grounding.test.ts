// @vitest-environment node
/**
 * Grounding on the real route, with a mock model: an age question cannot be
 * answered before a tool call (the first step is forced to call one), so an
 * age can no longer come from memory — baseline: « Stranger Things, plutôt
 * à partir de 13 ans » (catalogue 14) with no lookup at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test"

const h = vi.hoisted(() => ({
  calls: [] as Array<{ modelId: string; options: LanguageModelV3CallOptions }>,
  mediaFindMany: vi.fn(),
  mediaFindUnique: vi.fn(),
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
        const forced = options.toolChoice?.type === "required"
        const chunks: LanguageModelV3StreamPart[] = forced
          ? [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: "c1", toolName: "searchMedia", input: JSON.stringify({ q: "Stranger Things" }) },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage: USAGE },
            ]
          : [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: "La fiche la conseille dès 14 ans." },
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
    mediaItem: { findUnique: h.mediaFindUnique, findMany: h.mediaFindMany },
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
  recordAssistantMessage: async () => ({}),
  newSessionId: () => "tt_s",
  TOTEM_SESSION_COOKIE: "totem_sid",
  TOTEM_TURN_CAP: 20,
}))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: async () => ["m-st"], matchMediaIdsByTheme: async () => [] }))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { POST } from "../route"

async function chat(text: string, sourcePage = "/") {
  const res = await POST(
    new NextRequest("http://localhost/api/totem/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "u", role: "user", parts: [{ type: "text", text }] }], sourcePage }),
    }),
  )
  return res.text()
}

beforeEach(() => {
  h.calls.length = 0
  h.mediaFindMany.mockReset()
  h.mediaFindMany.mockResolvedValue([
    {
      id: "m-st",
      title: "Stranger Things",
      originalTitle: null,
      type: "TV",
      releaseDate: null,
      posterUrl: null,
      expertAgeRec: 14,
      communityAgeRec: null,
      genres: [],
      synopsisFr: null,
      isEnriched: true,
    },
  ])
  h.mediaFindUnique.mockReset()
  h.mediaFindUnique.mockResolvedValue(null)
})

describe("an age question is looked up before it is answered", () => {
  it("forces a tool call on the first step only, with the same tools (cache intact)", async () => {
    const sse = await chat("Mon fils de 8 ans peut-il regarder Stranger Things ?")
    expect(h.calls[0].options.toolChoice).toEqual({ type: "required" })
    expect(h.calls[1].options.toolChoice).not.toEqual({ type: "required" })
    expect(h.calls[1].options.tools?.map((t) => t.name)).toEqual(h.calls[0].options.tools?.map((t) => t.name))
    expect(h.mediaFindMany).toHaveBeenCalled()
    expect(sse).toContain("dès 14 ans")
  })

  it("leaves a recommendation request free", async () => {
    await chat("Un film pour ce soir à la maison ?")
    expect(h.calls[0].options.toolChoice).not.toEqual({ type: "required" })
  })

  it("does not force a lookup for « ce film » on its own fiche", async () => {
    h.mediaFindUnique.mockResolvedValue({
      id: "m-vv",
      title: "Vice-versa",
      type: "MOVIE",
      expertAgeRec: 8,
      releaseDate: new Date("2015-06-17"),
    })
    await chat("Ce film convient à un enfant de 6 ans ?", "/media/movie:m-vv")
    expect(h.calls[0].options.toolChoice).not.toEqual({ type: "required" })
  })
})
