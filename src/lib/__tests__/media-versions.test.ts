import { beforeEach, describe, expect, it, vi } from "vitest"

const prisma = vi.hoisted(() => ({
  mediaSimilarity: { findMany: vi.fn() },
  mediaItem: { findUnique: vi.fn(), findMany: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

import {
  buildVersionsBlock,
  getMediaVersions,
  MAX_VERSIONS,
  versionEntryLabel,
  workNameKey,
  type VersionEntry,
} from "../media-versions"
import { getSimilarMedia } from "../similar-media"

const entry = (over: Partial<VersionEntry> & { id: string; title: string }): VersionEntry => ({
  type: "MOVIE",
  releaseDate: null,
  expertAgeRec: 8,
  isEnriched: true,
  ...over,
})

beforeEach(() => vi.resetAllMocks())

describe("versions block (pure)", () => {
  it("« <Titre> (<année>) · <âge> », TP never blank, an estimate flagged", () => {
    expect(versionEntryLabel(entry({ id: "a", title: "Beetlejuice", releaseDate: "1988-03-30", expertAgeRec: 10 }))).toBe(
      "Beetlejuice (1988) · Dès 10 ans",
    )
    expect(versionEntryLabel(entry({ id: "b", title: "Bluey", expertAgeRec: 0 }))).toBe("Bluey · Tous publics")
    expect(versionEntryLabel(entry({ id: "c", title: "X", expertAgeRec: 12, isEnriched: false }))).toBe(
      "X · Dès 12 ans (à confirmer)",
    )
    expect(versionEntryLabel(entry({ id: "d", title: "Y", expertAgeRec: null }))).toBe("Y · Âge à confirmer")
  })

  it("same name → « Autres versions de <Titre> » (case, accents, trailing parenthetical ignored)", () => {
    const block = buildVersionsBlock("Charlie et la chocolaterie", [
      entry({ id: "1971", title: "Charlie et la Chocolaterie", releaseDate: "1971-06-30", expertAgeRec: 6 }),
    ])
    expect(block?.heading).toBe("Autres versions de Charlie et la chocolaterie")
    expect(workNameKey("Scrooge (Un Conte De Noël)")).toBe(workNameKey("Scrooge"))
  })

  it("different names → « Autres versions et suites », sorted by year, no age filter", () => {
    const block = buildVersionsBlock("Conjuring : Les Dossiers Warren", [
      entry({ id: "c4", title: "Conjuring : L'Heure du jugement", releaseDate: "2025-09-03", expertAgeRec: 12 }),
      entry({ id: "c2", title: "Conjuring 2 : Le Cas Enfield", releaseDate: "2016-06-01", expertAgeRec: 12 }),
      entry({ id: "c3", title: "Conjuring : Sous l'emprise du Diable", releaseDate: "2021-05-26", expertAgeRec: 14 }),
    ])
    expect(block?.heading).toBe("Autres versions et suites")
    expect(block?.items.map((i) => i.id)).toEqual(["c2", "c3", "c4"])
  })

  it("an older-rated remake is shown, with its own age", () => {
    const block = buildVersionsBlock("Beetlejuice", [
      entry({ id: "bb", title: "Beetlejuice Beetlejuice", releaseDate: "2024-09-06", expertAgeRec: 12 }),
    ])
    expect(block?.items[0].label).toBe("Beetlejuice Beetlejuice (2024) · Dès 12 ans")
  })

  it("hidden when empty; at most MAX_VERSIONS, duplicates folded", () => {
    expect(buildVersionsBlock("X", [])).toBeNull()
    const many = Array.from({ length: 12 }, (_, i) =>
      entry({ id: `m${i}`, title: `X ${i}`, releaseDate: `${2000 + i}-01-01` }),
    )
    const block = buildVersionsBlock("X", [...many, many[0]])
    expect(block?.items).toHaveLength(MAX_VERSIONS)
    expect(block?.items[0].id).toBe("m0")
  })
})

describe("versions lookup", () => {
  it("reads only EXPERT editorial_cluster edges, both directions, games included", async () => {
    const game = (id: string, title: string, year: string, age: number) => ({
      id, title, type: "GAME", releaseDate: new Date(`${year}-01-01`), expertAgeRec: age, isEnriched: true,
    })
    const current = game("mw", "Call of Duty: Modern Warfare", "2019", 18)
    prisma.mediaSimilarity.findMany.mockResolvedValue([
      { mediaIdA: "cod4", mediaA: game("cod4", "Call of Duty 4: Modern Warfare", "2007", 16), mediaB: current },
      { mediaIdA: "mw", mediaA: current, mediaB: game("mwr", "Call of Duty: Modern Warfare Remastered", "2016", 16) },
    ])
    const block = await getMediaVersions("mw", "Call of Duty: Modern Warfare")
    expect(prisma.mediaSimilarity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: "EXPERT",
          reasons: { has: "editorial_cluster" },
          OR: [{ mediaIdA: "mw" }, { mediaIdB: "mw" }],
        },
      }),
    )
    expect(block?.items.map((i) => i.label)).toEqual([
      "Call of Duty 4: Modern Warfare (2007) · Dès 16 ans",
      "Call of Duty: Modern Warfare Remastered (2016) · Dès 16 ans",
    ])
  })

  it("a failed lookup hides the block instead of failing the fiche", async () => {
    prisma.mediaSimilarity.findMany.mockRejectedValue(new Error("db down"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await getMediaVersions("x", "X")).toBeNull()
  })
})

describe("« Titres similaires » never repeats a version", () => {
  it("drops cluster titles from the edges and the genre top-up; keeps the age rule", async () => {
    const item = (id: string, age: number | null) => ({
      id, title: id, type: "MOVIE", posterUrl: "https://img/p.jpg", expertAgeRec: age,
      genres: ["Fantastique"], topics: [], releaseDate: null, director: null, tmdbRating: 7,
    })
    prisma.mediaSimilarity.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ("source" in args.where) {
        // editorial cluster lookup
        return [{ mediaIdA: "bj", mediaA: item("bj", 10), mediaB: { ...item("bjbj", 12), isEnriched: true } }]
      }
      return [
        { mediaIdA: "bj", mediaIdB: "bjbj", mediaA: item("bj", 10), mediaB: item("bjbj", 12), similarityScore: 0.95 },
        { mediaIdA: "bj", mediaIdB: "ok", mediaA: item("bj", 10), mediaB: item("ok", 8), similarityScore: 0.8 },
        { mediaIdA: "bj", mediaIdB: "old", mediaA: item("bj", 10), mediaB: item("old", 14), similarityScore: 0.7 },
      ]
    })
    prisma.mediaItem.findUnique.mockResolvedValue({ director: null, expertAgeRec: 10 })
    prisma.mediaItem.findMany.mockResolvedValue([])

    const out = await getSimilarMedia({ mediaId: "bj", mediaType: "MOVIE", genres: ["Fantastique"], topics: [] })
    expect(out.map((s) => s.id)).toEqual(["ok"])

    const edgeQuery = prisma.mediaSimilarity.findMany.mock.calls.find(
      (call) => !("source" in (call[0] as { where: Record<string, unknown> }).where),
    )?.[0]
    expect(edgeQuery.where.NOT).toEqual({ reasons: { has: "editorial_cluster" } })
    const topUp = prisma.mediaItem.findMany.mock.calls[0][0]
    expect(topUp.where.id.notIn).toEqual(expect.arrayContaining(["bj", "bjbj", "ok"]))
  })
})
