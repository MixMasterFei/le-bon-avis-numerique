import { beforeEach, describe, expect, it, vi } from "vitest"
const db = vi.hoisted(() => ({ findFirst: vi.fn(), query: vi.fn(), movies: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findFirst: db.findFirst }, $queryRaw: db.query } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (run: () => unknown) => run() }))
vi.mock("@/lib/media-queries", () => ({ fetchMovies: db.movies, fetchSeries: db.movies, fetchGames: db.movies }))
import { loadMediaMdInput } from "@/lib/markdown/media-md-data"
import { renderMediaMarkdown, mediaAssessment, type MediaMdInput } from "@/lib/markdown/media-md"
import { searchCatalog, searchMedia, ageVerdict, recommendForAge } from "./totem-tools"
import { executeTool, toolOutputSchema } from "./result"
import { GET as markdownMedia } from "@/app/md/media/[id]/route"
import { GET as markdownSelection } from "@/app/md/selection/[type]/[age]/route"

const uuid = "7bee43dc-3c39-4fe8-87a0-13dabfab4c06"
const metrics = { violence: 4, sexNudity: 1, language: 2, substanceUse: 0, consumerism: 0, positiveMessages: 4, roleModels: 3, whatParentsNeedToKnow: ["Combats intenses."] }
const movie = {
  id: uuid, title: "Matrix", originalTitle: "The Matrix", type: "MOVIE", tmdbId: 603, igdbId: null,
  posterUrl: "https://example.com/poster.jpg", dataQualityScore: 80, expertAgeRec: 14, officialRating: "16",
  isEnriched: true, releaseStatus: "Released", releaseDate: new Date("1999-03-31"), updatedAt: new Date("2026-09-04"),
  topics: ["science-fiction"], genres: ["Science-Fiction"], contentMetrics: {
    ...metrics, enrichmentSource: "AI", enrichmentConfidence: 0.8, pass1At: new Date("2026-07-01"), pass2At: null,
    sensitiveWarnings: ["Scènes effrayantes ou angoissantes"], sensitiveWarningsAt: new Date("2026-07-01"),
  },
}
const input: MediaMdInput = { ...movie, type: "MOVIE", releaseDate: "1999-03-31", hasContentAnalysis: true,
  assessmentConfidence: 0.8, assessmentSource: "AI", assessedAt: new Date("2026-07-01"),
  sensitiveWarnings: movie.contentMetrics.sensitiveWarnings, sensitiveWarningsAt: new Date("2026-07-01"), contentMetrics: metrics }
beforeEach(() => { vi.clearAllMocks(); db.findFirst.mockResolvedValue(movie); db.query.mockResolvedValue([]); db.movies.mockResolvedValue({ items: [] }) })

describe("typed media identifiers", () => {
  it.each(["movie:603oops", "game:123bad", "603", "unknown:603", "book:603", "movie:2147483648", "movie:%ZZ", "movie:", "movie:0", "movie:-1", `manga:${uuid}`])("rejects %s without querying", async (id) => {
    expect(await loadMediaMdInput(id)).toBeNull()
    expect(db.findFirst).not.toHaveBeenCalled()
  })
  it.each([["movie", "MOVIE", "tmdbId"], ["tv", "TV", "tmdbId"], ["game", "GAME", "igdbId"]])("keeps the %s numeric namespace", async (prefix, type, provider) => {
    db.findFirst.mockResolvedValue(null)
    expect(await loadMediaMdInput(`${prefix}:603`)).toBeNull()
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type, [provider]: 603, dataQualityScore: { gte: 30 } }) }))
    expect(db.findFirst).toHaveBeenCalledTimes(1)
  })
  it("keeps the type constraint for UUIDs and supports encoded route IDs", async () => {
    await loadMediaMdInput(`game%3A${uuid}`)
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: uuid, type: "GAME" }) }))
  })
  it("preserves raw UUID lookup and assessment dates separately", async () => {
    const result = await loadMediaMdInput(uuid)
    expect(result?.assessedAt).toEqual(new Date("2026-07-01"))
    expect(result?.updatedAt).toEqual(new Date("2026-09-04"))
  })
})

describe("catalogue search and disambiguation", () => {
  it.each(["Vice versa", "Vice-Versa", "VICE VERSA"])("normalizes %s before the database query", async (query) => {
    await searchCatalog(query)
    const sql = db.query.mock.calls[0][0]
    expect(sql.values).toContain("viceversa")
    expect(sql.text).toContain("unaccent")
    expect(sql.text).toContain("poster_url IS NOT NULL")
    expect(sql.text.indexOf("data_quality_score")).toBeLessThan(sql.text.indexOf("LIMIT"))
  })
  it("parameterizes quotes and SQL-like input", async () => {
    const malicious = "Matrix'; DROP TABLE media_items; --"
    await searchCatalog(malicious, "jeu", 10, 2024)
    const sql = db.query.mock.calls[0][0]
    expect(sql.text).not.toContain(malicious)
    expect(sql.values).toContain("GAME")
    expect(sql.values).toContainEqual(new Date("2024-01-01T00:00:00Z"))
  })
  it.each(["  ", "!!!", "%_"])("rejects empty normalized query %s", async (query) => {
    expect((await searchMedia(query)).data.status).toBe("invalid_input")
    expect(db.query).not.toHaveBeenCalled()
  })
  it("does not choose between exact-title remakes", async () => {
    db.query.mockResolvedValue([{ ...movie, title: "L'Odyssée", originalTitle: null, releaseDate: new Date("2016-10-12") }, { ...movie, id: "other", title: "L'Odyssée", originalTitle: null, releaseDate: new Date("2026-07-15") }])
    const result = await ageVerdict({ title: "Odyssee" })
    expect(result.data.status).toBe("ambiguous")
    expect(db.findFirst).not.toHaveBeenCalled()
    expect(result.text).toContain("2016")
    expect(result.text).toContain("2026")
    expect(toolOutputSchema.safeParse(result.data).success).toBe(true)
  })
  it("resolves an exact original-language title", async () => {
    db.query.mockResolvedValue([movie, { ...movie, id: "other", title: "Matrix Reloaded", originalTitle: "The Matrix Reloaded" }])
    const result = await ageVerdict({ title: "The Matrix" })
    expect(result.data.status).toBe("ok")
    expect(result.text).toBe(renderMediaMarkdown((await loadMediaMdInput(uuid))!))
    expect(toolOutputSchema.safeParse(result.data).success).toBe(true)
  })
  it("rejects a contradictory year on an explicit ID", async () => {
    expect((await ageVerdict({ id: `movie:${uuid}`, year: 2020 })).data.status).toBe("invalid_input")
  })
  it("returns an empty result for an absent title", async () => {
    const result = await searchMedia("absent")
    expect(result.data.status).toBe("not_found")
    expect(toolOutputSchema.safeParse(result.data).success).toBe(true)
  })
})

describe("assessment fidelity", () => {
  it("exports all eight indicators, warning reservations and unknown jurisdiction", () => {
    const markdown = renderMediaMarkdown(input)
    expect(markdown.match(/\/5/g)).toHaveLength(8)
    expect(markdown).toContain("Valeur éducative: 2/5")
    expect(markdown).toContain("Scènes effrayantes ou angoissantes")
    expect(markdown).toContain("pas de scènes confirmées")
    expect(markdown).toContain("pays et organisme non renseignés")
    expect(markdown).toContain("Dernière analyse datée: 2026-07-01")
  })
  it.each([{ isEnriched: false }, { releaseDate: "2099-01-01" }, { hasContentAnalysis: false }])("withholds unassessed scores and warnings: %j", (overrides) => {
    const media = { ...input, ...overrides }
    expect(mediaAssessment(media).metrics).toBeNull()
    expect(mediaAssessment(media).warnings).toEqual([])
    expect(renderMediaMarkdown(media)).not.toContain("/5")
  })
  it("does not treat missing or low-confidence warnings as a clean bill of health", () => {
    expect(mediaAssessment({ ...input, assessmentConfidence: 0.2 }).warningsStatus).toBe("unavailable")
    expect(mediaAssessment({ ...input, sensitiveWarnings: [], sensitiveWarningsAt: null }).warningsStatus).toBe("unavailable")
  })
  it("keeps confident legacy warnings even when their date is missing", () => {
    expect(mediaAssessment({ ...input, sensitiveWarningsAt: null }).warnings).toHaveLength(1)
  })
  it("cannot recommend an item above the requested age even if browse returns it", async () => {
    db.movies.mockResolvedValue({ items: [
      { ...movie, releaseDate: "1999-03-31", expertAgeRec: 14 },
      { ...movie, releaseDate: "1999-03-31", expertAgeRec: 6, isProvisional: true },
      { ...movie, releaseDate: "1999-03-31", expertAgeRec: 6, releaseStatus: "alpha" },
      { ...movie, releaseDate: "2099-03-31", expertAgeRec: 6 },
      { ...movie, releaseDate: "1999-03-31", expertAgeRec: 6, contentMetrics: null },
      { ...movie, releaseDate: "1999-03-31", expertAgeRec: 7 },
    ] })
    const result = await recommendForAge(7)
    expect(result.data.result.kind === "selection" && result.data.result.items.map((m) => m.age)).toEqual([7])
    expect(toolOutputSchema.safeParse(result.data).success).toBe(true)
  })
})

describe("temporary failures", () => {
  it.each(["constructor", "__proto__", "toString"])("rejects unknown selection type %s before fetching", async (type) => {
    const response = await markdownSelection(new Request("https://example.com"), { params: Promise.resolve({ type, age: "7" }) })
    expect(response.status).toBe(404)
    expect(db.movies).not.toHaveBeenCalled()
  })
  it("returns a structured error and logs no query or private error text", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    const result = await executeTool("search_media", async () => { throw new Error("private query context") })
    expect(result.isError).toBe(true)
    expect(result.structuredContent.status).toBe("unavailable")
    expect(JSON.stringify(log.mock.calls)).not.toContain("private query")
    expect(JSON.stringify(result)).not.toContain("private query")
    log.mockRestore()
  })
  it("returns an uncached 503 for Markdown lookup failure", async () => {
    db.findFirst.mockRejectedValue(new Error("offline"))
    const response = await markdownMedia(new Request("https://example.com"), { params: Promise.resolve({ id: `movie:${uuid}` }) })
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("60")
  })
  it("returns an uncached 503 for selection failure", async () => {
    db.movies.mockRejectedValue(new Error("offline"))
    const response = await markdownSelection(new Request("https://example.com"), { params: Promise.resolve({ type: "films", age: "7" }) })
    expect(response.status).toBe(503)
  })
  it("keeps a real missing identifier as 404", async () => {
    db.findFirst.mockResolvedValue(null)
    const response = await markdownMedia(new Request("https://example.com"), { params: Promise.resolve({ id: `movie:${uuid}` }) })
    expect(response.status).toBe(404)
  })
})
