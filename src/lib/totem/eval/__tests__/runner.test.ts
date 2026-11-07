// @vitest-environment node
/**
 * The bench drives the REAL pipeline (startTotemTurn + buildTrustedHistory)
 * with a scripted mock model: the fictional household reaches the prompt and
 * the tools, multi-turn history carries over, accepted cards change what the
 * household has seen — and nothing is ever written to totem_messages.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test"
import type { EvalScenario } from "../types"

type Script = (options: LanguageModelV3CallOptions) => LanguageModelV3StreamPart[]

const h = vi.hoisted(() => ({
  calls: [] as Array<{ modelId: string; options: LanguageModelV3CallOptions }>,
  script: [] as Script[],
  findMany: vi.fn(),
  totemCreate: vi.fn(),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) =>
    new MockLanguageModelV3({
      modelId,
      doStream: async (options) => {
        h.calls.push({ modelId, options })
        const next = h.script.shift()
        return { stream: convertArrayToReadableStream(next ? next(options) : say("Très bien.")) }
      },
    }),
}))

const ROWS = [
  { id: "m-int", title: "Interstellar", originalTitle: "Interstellar", type: "MOVIE", expertAgeRec: 12, communityAgeRec: null, isEnriched: true, officialRating: null, releaseDate: new Date("2014-11-05"), posterUrl: null, genres: ["Science-Fiction"], synopsisFr: "Espace.", topics: [] },
  { id: "m-pad", title: "Paddington", originalTitle: "Paddington", type: "MOVIE", expertAgeRec: 6, communityAgeRec: null, isEnriched: true, officialRating: null, releaseDate: new Date("2014-12-03"), posterUrl: null, genres: ["Familial", "Animation"], synopsisFr: "Un ours.", topics: [] },
  { id: "m-cars", title: "Cars", originalTitle: "Cars", type: "MOVIE", expertAgeRec: 6, communityAgeRec: null, isEnriched: true, officialRating: null, releaseDate: new Date("2006-06-14"), posterUrl: null, genres: ["Animation"], synopsisFr: "Des voitures.", topics: [] },
]

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: {
      findMany: h.findMany,
      findUnique: async ({ where }: { where: { id: string } }) => ROWS.find((r) => r.id === where.id) ?? null,
    },
    newsStory: { findUnique: async () => null, findFirst: async () => null, findMany: async () => [] },
    mediaReaction: { findMany: async () => [] },
    familyMember: { findMany: async () => [] },
    totemMessage: { create: h.totemCreate, findMany: h.totemCreate, count: h.totemCreate },
  },
}))
vi.mock("@/lib/search-normalize", () => ({
  matchMediaIdsByTitle: async (q: string) => ROWS.filter((r) => r.title.toLowerCase().includes(q.toLowerCase().slice(0, 5))).map((r) => r.id),
  matchMediaIdsByTheme: async () => ["m-pad", "m-int"],
}))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { runEvalSuite } from "../runner"

const USAGE = {
  inputTokens: { total: 50_000, noCache: 10_000, cacheRead: 40_000, cacheWrite: 0 },
  outputTokens: { total: 400, text: 400, reasoning: undefined },
}
function say(text: string): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage: USAGE },
  ]
}
function call(toolName: string, input: unknown, id = `c-${toolName}`, lead?: string): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    ...(lead
      ? ([
          { type: "text-start", id: "lead" },
          { type: "text-delta", id: "lead", delta: lead },
          { type: "text-end", id: "lead" },
        ] as LanguageModelV3StreamPart[])
      : []),
    { type: "tool-call", toolCallId: id, toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage: USAGE },
  ]
}
const promptText = (o: LanguageModelV3CallOptions) => JSON.stringify(o.prompt)

beforeEach(() => {
  h.calls.length = 0
  h.script.length = 0
  h.totemCreate.mockReset()
  h.findMany.mockReset()
  h.findMany.mockImplementation(
    async (args: {
      where?: { id?: { in?: string[] }; NOT?: { id?: { in?: string[] } }; expertAgeRec?: { lte?: number } }
    }) =>
      ROWS.filter((r) => !args.where?.id?.in || args.where.id.in.includes(r.id))
        .filter((r) => !args.where?.NOT?.id?.in?.includes(r.id))
        .filter((r) => args.where?.expertAgeRec?.lte == null || r.expertAgeRec <= args.where.expertAgeRec.lte),
  )
})

const base = { origin: "http://localhost", concurrency: 1 }

describe("runEvalSuite", () => {
  it("runs a grounding scenario through the real pipeline and checks it against the catalogue", async () => {
    const scenario: EvalScenario = {
      id: "t-int",
      category: "grounding",
      title: "Interstellar",
      family: "eval",
      subjects: { int: { q: "Interstellar", type: "MOVIE", exact: "Interstellar" } },
      turns: [{ user: "Interstellar, c'est pour quel âge ?", expect: { subjects: ["int"], notMissing: true } }],
    }
    h.script.push(() => call("searchMedia", { q: "Interstellar" }))
    h.script.push(() => say("*Interstellar* est recommandé à partir de 13 ans."))

    const run = await runEvalSuite({ ...base, scenarios: [scenario] })
    const [result] = run.scenarios

    // The fictional household reached the prompt through the family block.
    const tail = promptText(h.calls[0].options)
    expect(tail).toContain("Léa (6 ans)")
    expect(tail).toContain("Hugo (10 ans)")
    expect(tail).toContain("Inès (14 ans)")
    expect(tail).toContain("Utilisateur connecté : OUI")
    // Live router by default.
    expect(h.calls[0].modelId).toBe("claude-haiku-4-5-20251001")

    expect(result.status).toBe("fail")
    const failed = result.turns[0].checks.filter((c) => !c.pass).map((c) => c.id)
    expect(failed).toEqual(["ages_match_db"])
    expect(result.turns[0].trace.usage).toMatchObject({ inputTokens: 100_000, cachedInputTokens: 80_000 })
    expect(result.costUsd).toBeGreaterThan(0)
    expect(h.totemCreate).not.toHaveBeenCalled()
  })

  it("carries history across turns and applies accepted cards to the household", async () => {
    const scenario: EvalScenario = {
      id: "t-vu",
      category: "memory",
      title: "déjà vu",
      family: "eval",
      turns: [
        { user: "Un film pour Léa ?", expect: { audience: { members: ["Léa"] }, respectAudienceAge: true } },
        { user: "Elle l'a déjà vu.", cards: "accept", expect: { offersToRecord: "WATCHED" } },
        { user: "Une autre idée ?", expect: { noRepeats: true } },
      ],
    }
    // Turn 1: a theme search, then Paddington.
    h.script.push(() => call("searchMedia", { theme: "famille", maxAge: 6 }, "s1"))
    h.script.push(() => say("*Paddington* est parfait pour Léa."))
    // Turn 2: the bot proposes to record WATCHED for Léa.
    h.script.push(() =>
      call(
        "proposeReaction",
        {
          mediaId: "m-pad",
          mediaTitle: "Paddington",
          familyMemberId: "eval-member-lea",
          familyMemberName: "Léa",
          reaction: "WATCHED",
        },
        "r1",
        "Je note que Léa l'a déjà vu ?",
      ),
    )
    // Turn 3: a new search, which must now hide Paddington.
    h.script.push(() => call("searchMedia", { maxAge: 6 }, "s2"))
    h.script.push(() => say("Alors *Cars* ?"))

    const run = await runEvalSuite({ ...base, scenarios: [scenario], model: "claude-haiku-5-5" })
    const [result] = run.scenarios

    expect(h.calls.every((c) => c.modelId === "claude-haiku-5-5")).toBe(true)
    // Turn 2's prompt holds turn 1's answer (trusted history, same builder as the route).
    expect(promptText(h.calls[2].options)).toContain("*Paddington* est parfait pour Léa")
    // Turn 3: the accepted card was answered and the search hid the seen title.
    expect(promptText(h.calls[3].options)).toContain('"accepted":true')
    const lastSearch = h.findMany.mock.calls.at(-2)?.[0] as { where: { NOT?: { id?: { in?: string[] } } } }
    expect(lastSearch.where.NOT?.id?.in).toEqual(["m-pad"])

    expect(result.turns.map((t) => t.checks.filter((c) => !c.pass).map((c) => c.id))).toEqual([[], [], []])
    expect(result.status).toBe("pass")
    expect(h.totemCreate).not.toHaveBeenCalled()
  })

  it("flags a turn that ends on a bare action card as a blank reply", async () => {
    h.script.push(() => call("proposeNavigation", { path: "/inscription", label: "Inscription", reason: "Pour créer un compte" }))
    const run = await runEvalSuite({
      ...base,
      scenarios: [{ id: "t-nav", category: "reliability", title: "nav", family: "none", turns: [{ user: "Où créer un compte ?" }] }],
    })
    const failed = run.scenarios[0].turns[0].checks.filter((c) => !c.pass).map((c) => c.id)
    expect(failed).toContain("not_blank")
  })

  it("skips a scenario whose title is not in the catalogue instead of blaming the bot", async () => {
    const run = await runEvalSuite({
      ...base,
      scenarios: [
        { id: "t-x", category: "grounding", title: "x", family: "none", subjects: { x: { q: "Zzz introuvable" } }, turns: [{ user: "?" }] },
      ],
    })
    expect(run.scenarios[0]).toMatchObject({ status: "skipped", skipReason: expect.stringContaining("absent du catalogue") })
    expect(h.calls).toHaveLength(0)
  })

  it("stops launching scenarios when the time budget is spent", async () => {
    const run = await runEvalSuite({
      ...base,
      launchBudgetMs: -1,
      scenarios: [{ id: "t-late", category: "tone", title: "late", family: "none", turns: [{ user: "?" }] }],
    })
    expect(run.scenarios[0]).toMatchObject({ status: "skipped" })
    expect(h.calls).toHaveLength(0)
  })
})
