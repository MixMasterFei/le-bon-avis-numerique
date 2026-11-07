// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: { aiBotHit: { upsert: vi.fn() } } }))

import { prisma } from "@/lib/prisma"
import { mcpClientToken, mcpUsageRows, recordMcpUsage } from "./usage"
import { withAttribution, type ToolOutput, type ToolResponse } from "./result"

const upsert = vi.mocked(prisma.aiBotHit.upsert)

const FICHE = "https://totemavise.com/media/movie:3fa85f64-5717-4562-b3fc-2c963f66afa6"
const match = { id: "movie:3fa85f64-5717-4562-b3fc-2c963f66afa6", title: "Le Robot sauvage", type: "MOVIE" as const, year: 2024, age: 6, provisional: false, url: FICHE }

const searchData = (query: string): ToolOutput => ({ schemaVersion: 1, status: "ok", result: { kind: "search", query, matches: [match] } })
const verdictData: ToolOutput = {
  schemaVersion: 1,
  status: "ok",
  result: {
    kind: "verdict",
    candidates: [],
    media: {
      ...match,
      updatedAt: "2026-11-01T00:00:00.000Z",
      classification: { value: null, country: null, authority: null },
      assessment: {
        status: "available", source: null, assessedAt: null, confidence: null, metrics: null,
        educationalValueMethod: "derived_from_topics_and_positive_metrics",
        warningsStatus: "unavailable", warnings: [], warningsAssessedAt: null,
      },
    },
  },
}

beforeEach(() => vi.clearAllMocks())

describe("MCP usage counter", () => {
  it("names the calling assistant with a short token, never the raw User-Agent", () => {
    expect(mcpClientToken("Mozilla/5.0 (compatible; Claude-User/1.0; +https://example.com)")).toBe("Claude-User")
    expect(mcpClientToken("python-httpx/0.27.0")).toBe("python-httpx")
    expect(mcpClientToken(null)).toBe("inconnu")
  })

  it("counts one call per tool, and the fiche a verdict resolved to", () => {
    expect(mcpUsageRows("search_media", searchData("robot"), false, "Claude-User/1.0")).toEqual([
      { bot: "Claude-User", kind: "mcp", surface: "mcp-search_media" },
    ])
    expect(mcpUsageRows("get_age_verdict", verdictData, false, "Claude-User/1.0").map((r) => r.surface)).toEqual([
      "mcp-get_age_verdict",
      `mcp-fiche:${match.id}`,
    ])
    expect(mcpUsageRows("recommend_for_age", searchData("x"), true, null)[0].surface).toBe("mcp-recommend_for_age:erreur")
  })

  it("never stores the query text", () => {
    const rows = mcpUsageRows("search_media", searchData("Léa a peur du noir"), false, "Claude-User/1.0")
    expect(JSON.stringify(rows)).not.toMatch(/Léa|peur|noir/)
  })

  it("upserts day-bucketed rows and swallows database errors", async () => {
    upsert.mockRejectedValueOnce(new Error("relation does not exist"))
    await expect(recordMcpUsage([{ bot: "Claude-User", kind: "mcp", surface: "mcp-search_media" }])).resolves.toBeUndefined()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { day_bot_kind_surface: expect.objectContaining({ bot: "Claude-User", kind: "mcp", surface: "mcp-search_media" }) },
        update: { count: { increment: 1 } },
      }),
    )
  })
})

describe("attribution on every answer", () => {
  const response = (data: ToolOutput, text = "Réponse"): ToolResponse => ({ text, data })

  it("credits Totem Avisé and links the fiche on a verdict", () => {
    expect(withAttribution(response(verdictData)).text).toMatch(new RegExp(`Source : Totem Avisé — ${FICHE.replace(/[.]/g, "\\.")}$`))
  })

  it("credits the site on a search, including an empty one", () => {
    const empty: ToolOutput = { schemaVersion: 1, status: "not_found", result: { kind: "search", query: "zzz", matches: [] } }
    expect(withAttribution(response(empty)).text).toContain("Source : Totem Avisé — https://totemavise.com")
  })

  it("does not repeat an attribution the text already carries", () => {
    const selection: ToolOutput = { schemaVersion: 1, status: "ok", result: { kind: "selection", age: 7, type: "films", url: "https://totemavise.com/films?maxAge=7", items: [match] } }
    const text = "Source: Totem Avisé — repères…"
    expect(withAttribution(response(selection, text)).text).toBe(text)
  })

  it("leaves errors alone: there is nothing to quote", () => {
    const error: ToolOutput = { schemaVersion: 1, status: "invalid_input", result: { kind: "error", message: "x" } }
    expect(withAttribution(response(error, "x")).text).toBe("x")
  })
})
