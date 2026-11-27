// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Pins the enrichment cron's status when the text model fails: a retired or
// unreachable model must log "error" (failure email), not a quiet "partial".

const { logCronRun, findMany, itemUpdate, metricsUpsert, create } = vi.hoisted(() => ({
  logCronRun: vi.fn(),
  findMany: vi.fn(),
  itemUpdate: vi.fn(),
  metricsUpsert: vi.fn(),
  create: vi.fn(),
}))
vi.mock("@/lib/cron-log", () => ({ logCronRun }))
vi.mock("@/lib/tmdb", () => ({ getMovieKeywords: vi.fn(async () => []), getTVKeywords: vi.fn(async () => []) }))
vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findMany, update: itemUpdate }, contentMetrics: { upsert: metricsUpsert } },
}))
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } }
  },
}))

import { POST } from "../enrich/route"

const item = (id: string) => ({
  id,
  title: `Titre ${id}`,
  originalTitle: null,
  type: "MOVIE",
  synopsisFr: "Un synopsis assez long pour ne pas pénaliser la confiance de l'analyse.",
  genres: ["Animation"],
  releaseDate: new Date("2020-01-01"),
  officialRating: null,
  tmdbVoteCount: 10,
  tmdbId: null,
  demographic: null,
  pegiDescriptors: [],
  topics: [],
  contentMetrics: null,
})

const goodAnswer = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          expertAgeRec: 6,
          contentMetrics: { violence: 1, sexNudity: 0, language: 0, consumerism: 0, substanceUse: 0, positiveMessages: 4, roleModels: 4 },
          whatParentsNeedToKnow: ["a"],
          sensitiveWarnings: [],
          synopsis: "Un synopsis.",
          tags: ["Animation"],
          confidence: 0.8,
          toneTags: [],
          pacing: "Dynamique",
          visualStyle: "Animation 3D/CGI",
          emotionalThemes: [],
        }),
      },
    },
  ],
}

const call = () =>
  POST(new NextRequest("https://totemavise.com/api/admin/enrich", { method: "POST", body: JSON.stringify({ type: "movie", limit: 5 }) }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("OPENAI_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("POST /api/admin/enrich — model failures", () => {
  it("every analysis failing at the model call logs error (was partial before 27 Nov 2026)", async () => {
    findMany.mockResolvedValue([item("a"), item("b"), item("c")])
    create.mockRejectedValue(Object.assign(new Error("404 The model does not exist"), { status: 404 }))
    await call()
    expect(logCronRun).toHaveBeenCalledOnce()
    const logged = logCronRun.mock.calls[0][0]
    expect(logged.status).toBe("error")
    expect(logged.summary).toContain("Modèle indisponible ?")
    expect(logged.details).toMatchObject({ modelAttempts: 3, modelFailures: 3, enriched: 0 })
    expect(itemUpdate).not.toHaveBeenCalled()
  })

  it("an empty model answer counts as a model failure", async () => {
    findMany.mockResolvedValue([item("a")])
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] })
    await call()
    expect(logCronRun.mock.calls[0][0].status).toBe("error")
  })

  it("half the analyses failing logs partial", async () => {
    findMany.mockResolvedValue([item("a"), item("b")])
    create.mockResolvedValueOnce(goodAnswer).mockRejectedValueOnce(new Error("500 Internal"))
    await call()
    const logged = logCronRun.mock.calls[0][0]
    expect(logged.status).toBe("partial")
    expect(logged.details).toMatchObject({ modelAttempts: 2, modelFailures: 1, enriched: 1 })
  })

  it("a healthy run stays success and sends the shared text-model params", async () => {
    findMany.mockResolvedValue([item("a")])
    create.mockResolvedValue(goodAnswer)
    await call()
    expect(logCronRun.mock.calls[0][0].status).toBe("success")
    const params = create.mock.calls[0][0]
    expect(params).toMatchObject({ model: "gpt-6.1-terra", max_completion_tokens: 4000, reasoning_effort: "none" })
  })

  it("a DB failure on every item stays partial (not a model outage)", async () => {
    findMany.mockResolvedValue([item("a")])
    create.mockResolvedValue(goodAnswer)
    itemUpdate.mockRejectedValue(new Error("db down"))
    await call()
    expect(logCronRun.mock.calls[0][0].status).toBe("partial")
  })
})
