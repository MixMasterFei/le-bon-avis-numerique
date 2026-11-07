// @vitest-environment node
/**
 * Characterization of POST /api/totem/chat — what the MODEL receives and what
 * gets PERSISTED for a given request, captured through a mock language model
 * so the real `streamText` pipeline runs end to end.
 *
 * Written against the route BEFORE the prompt/tools/model call were extracted
 * into `src/lib/totem/pipeline.ts`; the snapshot it produced is the proof that
 * the extraction changed nothing. Later, deliberate behaviour changes (trusted
 * server-side history, all-step persistence, message ids…) update the snapshot
 * in their own commits, so `git log -p` on the .snap shows each one.
 */
import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test"

const h = vi.hoisted(() => ({
  calls: [] as Array<{ modelId: string; options: unknown }>,
  script: [] as unknown[][],
  auth: vi.fn(),
  prisma: {
    familyMember: { findMany: vi.fn() },
    mediaItem: { findUnique: vi.fn(), findMany: vi.fn() },
    newsStory: { findUnique: vi.fn() },
    mediaReaction: { findMany: vi.fn() },
  },
  persistence: {
    getOrCreateConversation: vi.fn(),
    countTurnsInConversation: vi.fn(),
    lastAssistantMentionedNudge: vi.fn(),
    loadConversationRows: vi.fn(),
    recordUserMessage: vi.fn(),
    recordAssistantMessage: vi.fn(),
  },
  matchByTitle: vi.fn(),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) =>
    new MockLanguageModelV3({
      modelId,
      doStream: async (options) => {
        h.calls.push({ modelId, options })
        const chunks = (h.script.shift() ?? textTurn("Réponse par défaut.")) as LanguageModelV3StreamPart[]
        return { stream: convertArrayToReadableStream(chunks) }
      },
    }),
}))
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: () => "assistant-msg-1",
}))
vi.mock("@/lib/auth", () => ({ auth: h.auth }))
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
vi.mock("@/lib/totem/persistence", () => ({
  ...h.persistence,
  newSessionId: () => "tt_test-session",
  TOTEM_SESSION_COOKIE: "totem_sid",
  TOTEM_TURN_CAP: 20,
}))
vi.mock("@/lib/search-normalize", () => ({
  matchMediaIdsByTitle: h.matchByTitle,
  matchMediaIdsByTheme: vi.fn(async () => []),
}))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: vi.fn(async () => []) }))

import { POST } from "../route"

const USAGE = {
  inputTokens: { total: 1200, noCache: 200, cacheRead: 900, cacheWrite: 100 },
  outputTokens: { total: 40, text: 40, reasoning: undefined },
}

function textTurn(text: string): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage: USAGE },
  ]
}

function toolTurn(toolCallId: string, toolName: string, input: unknown, lead?: string): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    ...(lead
      ? ([
          { type: "text-start", id: "lead" },
          { type: "text-delta", id: "lead", delta: lead },
          { type: "text-end", id: "lead" },
        ] as LanguageModelV3StreamPart[])
      : []),
    { type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage: USAGE },
  ]
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16)

/** Stable, reviewable description of one model call. */
function describeCall(call: { modelId: string; options: unknown }) {
  const o = call.options as LanguageModelV3CallOptions
  return {
    modelId: call.modelId,
    maxOutputTokens: o.maxOutputTokens,
    toolChoice: o.toolChoice,
    hasAbortSignal: o.abortSignal != null,
    tools: (o.tools ?? []).map((t) =>
      t.type === "function"
        ? {
            name: t.name,
            descriptionSha: sha(t.description ?? ""),
            schemaSha: sha(JSON.stringify(t.inputSchema)),
          }
        : { name: t.name },
    ),
    prompt: o.prompt.map((m) => {
      if (m.role !== "system") return m
      // The static head (soul + site brief + rules) is ~40 KB: pin it by hash.
      // The dynamic tail is small and is the part the route wires up, so keep
      // it verbatim.
      return m.content.startsWith("# Contexte dynamique")
        ? { role: "system", content: m.content, providerOptions: m.providerOptions }
        : {
            role: "system",
            contentSha: sha(m.content),
            length: m.content.length,
            providerOptions: m.providerOptions,
          }
    }),
  }
}

function userMsg(id: string, text: string) {
  return { id, role: "user", parts: [{ type: "text", text }] }
}

function chatRequest(body: unknown, cookie?: string) {
  return new NextRequest("http://localhost/api/totem/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

async function run(body: unknown, cookie?: string) {
  const res = await POST(chatRequest(body, cookie))
  const sse = await res.text()
  return {
    status: res.status,
    headers: {
      conversation: res.headers.get("x-totem-conversation-id"),
      remaining: res.headers.get("x-totem-rate-remaining"),
      setCookie: res.headers.get("set-cookie"),
    },
    sse: sse
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6)),
    modelCalls: h.calls.map(describeCall),
    persisted: {
      conversation: h.persistence.getOrCreateConversation.mock.calls.map((c) => c[0]),
      user: h.persistence.recordUserMessage.mock.calls.map((c) => c[0]),
      assistant: h.persistence.recordAssistantMessage.mock.calls.map((c) => ({
        ...c[0],
        latencyMs: typeof c[0].latencyMs,
      })),
    },
  }
}

const FAMILY_ROWS = [
  {
    name: "Léa",
    birthYear: 2020,
    birthMonth: 1,
    sensitivityViolence: 3,
    sensitivityScary: 3,
    sensitivitySexual: 3,
    sensitivityLanguage: 2,
    sensitivitySubstances: 3,
    favoriteGenres: ["Animation", "Familial"],
    avoidTopics: ["mort d'un parent"],
  },
  {
    name: "Hugo",
    birthYear: 2016,
    birthMonth: 1,
    sensitivityViolence: 2,
    sensitivityScary: 2,
    sensitivitySexual: 3,
    sensitivityLanguage: 1,
    sensitivitySubstances: 2,
    favoriteGenres: ["Aventure", "Science-Fiction"],
    avoidTopics: [],
  },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"))
  h.calls.length = 0
  h.script.length = 0
  h.auth.mockReset()
  for (const group of Object.values(h.prisma)) for (const fn of Object.values(group)) fn.mockReset()
  for (const fn of Object.values(h.persistence)) fn.mockReset()
  h.matchByTitle.mockReset()

  h.auth.mockResolvedValue(null)
  h.prisma.familyMember.findMany.mockResolvedValue([])
  h.prisma.mediaItem.findUnique.mockResolvedValue(null)
  h.prisma.mediaItem.findMany.mockResolvedValue([])
  h.prisma.newsStory.findUnique.mockResolvedValue(null)
  h.prisma.mediaReaction.findMany.mockResolvedValue([])
  h.persistence.getOrCreateConversation.mockResolvedValue({ id: "conv-1" })
  h.persistence.countTurnsInConversation.mockResolvedValue(0)
  h.persistence.lastAssistantMentionedNudge.mockResolvedValue(false)
  h.persistence.loadConversationRows.mockResolvedValue([])
  h.persistence.recordUserMessage.mockResolvedValue({})
  h.persistence.recordAssistantMessage.mockResolvedValue(undefined)
  h.matchByTitle.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe("POST /api/totem/chat — characterization", () => {
  it("anonymous first turn on the home page", async () => {
    h.script.push(textTurn("Bonsoir ! Pour quel âge ?"))
    const out = await run({ messages: [userMsg("u1", "Un film pour ce soir ?")], sourcePage: "/" })
    expect(out).toMatchSnapshot()
  })

  it("signed-in family on a media page, with prior turns", async () => {
    h.auth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } })
    h.prisma.familyMember.findMany.mockResolvedValue(FAMILY_ROWS)
    h.prisma.mediaItem.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "m-123"
        ? { id: "m-123", title: "Vice-versa", type: "MOVIE", expertAgeRec: 6, releaseDate: new Date("2015-06-17") }
        : null,
    )
    h.persistence.countTurnsInConversation.mockResolvedValue(2)
    // The earlier turn as the route stored it (trusted history). Until
    // 2026-11 the browser re-sent it, tool outputs included.
    h.persistence.loadConversationRows.mockResolvedValue([
      { role: "user", content: "Bonjour", modelMessages: null, toolCalls: null },
      {
        role: "assistant",
        content: "Bonjour, que cherchez-vous ?",
        toolCalls: [{ type: "tool-call", step: 0, toolCallId: "call-0", toolName: "searchMedia", input: { q: "vice versa", limit: 5 } }],
        modelMessages: [
          {
            role: "assistant",
            content: [{ type: "tool-call", toolCallId: "call-0", toolName: "searchMedia", input: { q: "vice versa", limit: 5 } }],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-0",
                toolName: "searchMedia",
                output: { type: "json", value: { results: [{ id: "m-123", title: "Vice-versa", recommendedAge: 6 }] } },
              },
            ],
          },
          { role: "assistant", content: [{ type: "text", text: "Bonjour, que cherchez-vous ?" }] },
        ],
      },
    ])
    h.script.push(textTurn("Oui, dès 6 ans. Je creuse ?"))
    const out = await run({
      conversationId: "conv-1",
      sourcePage: "/media/movie:m-123",
      messages: [userMsg("u2", "Ce film convient à Léa ?")],
    })
    expect(out).toMatchSnapshot()

    // Legit multi-turn chats keep working: the model sees the same history
    // the browser-built version produced before the change (snapshot of
    // commit 9e346f1), now rebuilt from the stored turn.
    const strip = (v: unknown): unknown => JSON.parse(JSON.stringify(v))
    const history = (out.modelCalls[0].prompt as Array<{ role: string }>).filter((m) => m.role !== "system")
    expect(strip(history)).toEqual([
      { role: "user", content: [{ type: "text", text: "Bonjour" }] },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "call-0", toolName: "searchMedia", input: { q: "vice versa", limit: 5 } }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-0",
            toolName: "searchMedia",
            output: { type: "json", value: { results: [{ id: "m-123", title: "Vice-versa", recommendedAge: 6 }] } },
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "Bonjour, que cherchez-vous ?" }] },
      { role: "user", content: [{ type: "text", text: "Ce film convient à Léa ?" }] },
    ])
  })

  it("tool loop: searchMedia then answer", async () => {
    h.auth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } })
    h.matchByTitle.mockResolvedValue(["m-9"])
    h.prisma.mediaItem.findMany.mockResolvedValue([
      {
        id: "m-9",
        title: "Interstellar",
        originalTitle: "Interstellar",
        type: "MOVIE",
        releaseDate: new Date("2014-11-05"),
        posterUrl: null,
        expertAgeRec: 12,
        communityAgeRec: null,
        genres: ["Science-Fiction", "Drame"],
        synopsisFr: "Des astronautes traversent un trou de ver.",
      },
    ])
    h.script.push(toolTurn("call-1", "searchMedia", { q: "Interstellar" }, "Je regarde."))
    h.script.push(textTurn("Interstellar est conseillé dès 12 ans."))
    const out = await run({ messages: [userMsg("u1", "Interstellar, c'est pour quel âge ?")], sourcePage: "/films" })
    expect(out).toMatchSnapshot()
  })

  it("escalates a grave message to the escalation model", async () => {
    h.script.push(textTurn("Je suis désolé."))
    const out = await run({ messages: [userMsg("u1", "Mon fils fait des cauchemars depuis ce film")] })
    expect(out.modelCalls[0].modelId).toMatchSnapshot()
  })

  it("stops the tool loop after six model calls", async () => {
    h.matchByTitle.mockResolvedValue([])
    for (let i = 0; i < 8; i++) h.script.push(toolTurn(`loop-${i}`, "searchMedia", { q: `essai ${i}` }))
    const out = await run({ messages: [userMsg("u1", "Cherche encore et encore")] })
    expect(out.modelCalls).toHaveLength(6)
    expect(out.persisted.assistant).toHaveLength(1)
  })

  it("news article page context", async () => {
    h.prisma.newsStory.findUnique.mockResolvedValue({
      slug: "ecrans-ados",
      title: "Les écrans et les ados",
      category: "SOCIETE",
      summary: "Une étude sur le temps d'écran.",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
      status: "PUBLISHED",
    })
    h.script.push(textTurn("En bref : …"))
    const out = await run(
      { messages: [userMsg("u1", "Résume l'article")], sourcePage: "/apercudecouverte/ecrans-ados" },
      "totem_sid=tt_existing",
    )
    expect(out).toMatchSnapshot()
  })
})
