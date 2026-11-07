// @vitest-environment node
/**
 * Review #3 (reliability): the propose* tools are resolved in the browser. A
 * parent who ignores an action card and simply types a reply sends back an
 * assistant tool call that has no result. Without special handling the model
 * prompt fails to build (MissingToolResultsError) and the conversation is stuck
 * until a reload. This test was written first, against the unfixed route.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test"

const h = vi.hoisted(() => ({
  calls: 0,
  prisma: {
    familyMember: { findMany: vi.fn(async () => []) },
    mediaItem: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    newsStory: { findUnique: vi.fn(async () => null) },
    mediaReaction: { findMany: vi.fn(async () => []) },
    totemMessage: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
  },
  recordAssistantMessage: vi.fn(),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) =>
    new MockLanguageModelV3({
      modelId,
      doStream: async () => {
        h.calls++
        const chunks: LanguageModelV3StreamPart[] = [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Très bien, autre idée : …" },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "end_turn" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          },
        ]
        return { stream: convertArrayToReadableStream(chunks) }
      },
    }),
}))
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "user-1", role: "ADMIN" } }) }))
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }))
vi.mock("@/lib/totem/access", () => ({ canUseTotem: () => true }))
vi.mock("@/lib/totem/rate-limit", () => ({
  checkTotemRateLimit: async () => ({ allowed: true, remaining: 29, retryAfterSec: 0, limit: 30 }),
  getClientIpFromHeaders: () => "192.0.2.10",
}))
vi.mock("@/lib/totem/daily-cap", () => ({
  checkDailyCaps: async () => ({ allowed: true }),
  secondsUntilNextUtcDay: () => 3600,
}))
vi.mock("@/lib/totem/persistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/totem/persistence")>()),
  getOrCreateConversation: async () => ({ id: "conv-1", userId: "user-1" }),
  countTurnsInConversation: async () => 1,
  lastAssistantMentionedNudge: async () => false,
  recordUserMessage: async () => ({}),
  recordAssistantMessage: h.recordAssistantMessage,
}))

import { POST } from "../route"

beforeEach(() => {
  h.calls = 0
  h.recordAssistantMessage.mockReset()
})

describe("a parent ignores an action card and keeps chatting", () => {
  it("still gets an answer", async () => {
    // What the browser holds after turn 1: the assistant proposed a
    // navigation card (client-resolved tool, no execute on the server) and
    // the parent never clicked it.
    const ignoredCard = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "text", text: "Je vous emmène voir les films à l'affiche ?", state: "done" },
        {
          type: "tool-proposeNavigation",
          toolCallId: "call-nav-1",
          state: "input-available",
          input: { path: "/films?sort=cinema", label: "Au cinéma", reason: "Pour tout voir." },
        },
      ],
    }
    // The trusted server-side history (once the route stops trusting the
    // client) holds the same turn.
    h.prisma.totemMessage.findMany.mockResolvedValue([
      {
        id: "a1",
        role: "assistant",
        content: "Je vous emmène voir les films à l'affiche ?",
        createdAt: new Date("2026-11-07T10:00:01Z"),
        finishReason: "tool-calls",
        toolCalls: [{ type: "tool-call", toolCallId: "call-nav-1", toolName: "proposeNavigation", input: ignoredCard.parts[2].input }],
        toolResults: null,
        modelMessages: [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Je vous emmène voir les films à l'affiche ?" },
              { type: "tool-call", toolCallId: "call-nav-1", toolName: "proposeNavigation", input: ignoredCard.parts[2].input },
            ],
          },
        ],
      },
      {
        id: "u1",
        role: "user",
        content: "Qu'est-ce qui passe au cinéma ?",
        createdAt: new Date("2026-11-07T10:00:00Z"),
        finishReason: null,
        toolCalls: null,
        toolResults: null,
        modelMessages: null,
      },
    ])

    const res = await POST(
      new NextRequest("http://localhost/api/totem/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          sourcePage: "/",
          messages: [
            { id: "u1", role: "user", parts: [{ type: "text", text: "Qu'est-ce qui passe au cinéma ?" }] },
            ignoredCard,
            { id: "u2", role: "user", parts: [{ type: "text", text: "Non merci, plutôt un film à la maison." }] },
          ],
        }),
      }),
    )
    const sse = await res.text()

    expect(res.status).toBe(200)
    expect(sse).not.toContain('"type":"error"')
    expect(h.calls).toBe(1)
    expect(sse).toContain("Très bien, autre idée")
  })
})
