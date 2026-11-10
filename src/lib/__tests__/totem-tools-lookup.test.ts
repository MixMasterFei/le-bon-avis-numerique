// @vitest-environment node
/**
 * A by-title lookup finds the title the parent named, whatever hides it in a
 * recommendation (baseline 2026-11-08: Vice-versa 2, seen by Inès, « absent
 * du catalogue » when asked for Hugo), and every non-confirmed age is flagged.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ mediaFindMany: vi.fn(), byTitle: vi.fn(), fetch: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: async () => [] },
    mediaReaction: { findMany: async () => [] },
    mediaItem: { findMany: h.mediaFindMany },
  },
}))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: h.byTitle, matchMediaIdsByTheme: async () => [] }))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { buildTotemTools, type TotemFamilyDataAccess } from "../totem/tools"
import { inferTurnHints } from "../totem/turn-hints"

const row = (id: string, title: string, type: string, expertAgeRec: number | null, isEnriched = true) => ({
  id,
  title,
  originalTitle: null,
  type,
  releaseDate: new Date("2024-06-19"),
  posterUrl: null,
  expertAgeRec,
  communityAgeRec: null,
  genres: [],
  synopsisFr: null,
  isEnriched,
})

const opts = { toolCallId: "c", messages: [] }
type Exec = (input: unknown, o: typeof opts) => Promise<Record<string, unknown>>
const familyData: TotemFamilyDataAccess = {
  getSeenMediaIds: async () => new Set(["m-vv2"]),
  getUserFamilyContext: async () => ({}),
  getFamilyFit: async () => ({}),
}

function tools(userText: string) {
  const hints = inferTurnHints({ userText, family: [{ name: "Hugo", age: 10 }] })
  const t = buildTotemTools({
    origin: "http://x",
    cookieHeader: null,
    userId: "u",
    hints,
    familyData,
    shownMediaIds: new Set(["m-vv2"]),
  })
  return {
    search: (input: unknown) => (t.searchMedia.execute as unknown as Exec)(input, opts),
    rail: (input: unknown) => (t.getDiscoveryRail.execute as unknown as Exec)(input, opts),
  }
}
const titles = (out: Record<string, unknown>) => (out.results as Array<{ title: string }>).map((r) => r.title)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", h.fetch)
})

describe("by-title lookup", () => {
  it("finds a title seen by a sibling, already shown, too old for the child, of another type", async () => {
    h.byTitle.mockResolvedValue(["m-vv2"])
    h.mediaFindMany.mockResolvedValue([row("m-vv2", "Vice-versa 2", "MOVIE", 8)])
    // The model guessed the type wrong and passed the child's age.
    const out = await tools("Hugo peut-il regarder Vice-versa 2 ?").search({ q: "Vice-Versa 2", type: "TV", maxAge: 6 })
    expect(titles(out)).toEqual(["Vice-versa 2"])
    const where = h.mediaFindMany.mock.calls[0][0].where
    expect(where).toEqual({ id: { in: ["m-vv2"] }, type: { not: "MANGA" } })
  })

  it("ranks the requested type first without dropping the others", async () => {
    h.byTitle.mockResolvedValue(["g-1", "m-1"])
    h.mediaFindMany.mockResolvedValue([row("g-1", "Spider-Man", "GAME", 12), row("m-1", "Spider-Man", "MOVIE", 10)])
    const out = await tools("?").search({ q: "Spider-Man", type: "MOVIE" })
    expect((out.results as Array<{ type: string }>).map((r) => r.type)).toEqual(["MOVIE", "GAME"])
  })

  it("flags a provisional age and an unrated title", async () => {
    h.byTitle.mockResolvedValue(["m-v", "m-n"])
    h.mediaFindMany.mockResolvedValue([row("m-v", "Verity", "MOVIE", 16, false), row("m-n", "Inconnu", "MOVIE", null, false)])
    const out = await tools("?").search({ q: "Verity" })
    expect(out.results).toEqual([
      expect.objectContaining({ title: "Verity", recommendedAge: 16, ageStatus: "provisoire" }),
      expect.objectContaining({ title: "Inconnu", ageStatus: "non évalué" }),
    ])
  })

  it("tries the other spellings before saying it is not there", async () => {
    h.byTitle.mockImplementation(async (q: string) => (q === "Mortal Kombat II" ? ["m-mk"] : []))
    h.mediaFindMany.mockResolvedValue([row("m-mk", "Mortal Kombat II", "MOVIE", 16)])
    const out = await tools("?").search({ q: "Mortal Kombat 2" })
    expect(titles(out)).toEqual(["Mortal Kombat II"])
    expect(out.matchedQuery).toBe("Mortal Kombat II")

    h.byTitle.mockResolvedValue([])
    const none = await tools("?").search({ q: "Titre qui n'existe pas" })
    expect(none).toMatchObject({ results: [], status: "not_found" })
  })
})

describe("cinema rail", () => {
  it("keeps only films with a fiche, and flags provisional ages", async () => {
    h.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        movies: [
          { id: "tmdb-1", title: "Pas importé", expertAgeRec: 8, genres: [], releaseDate: "2026-11-04", inDatabase: false, isProvisional: true },
          { id: "m-a", title: "Analysé", expertAgeRec: 8, genres: [], releaseDate: "2026-11-04", inDatabase: true, isProvisional: false },
          { id: "m-b", title: "Pas encore analysé", expertAgeRec: 10, genres: [], releaseDate: "2026-11-04", inDatabase: true, isProvisional: true },
        ],
      }),
    })
    const out = await tools("Qu'est-ce qu'on peut voir au cinéma avec Hugo ?").rail({ rail: "cinema" })
    expect(out.results).toEqual([
      expect.not.objectContaining({ ageStatus: expect.anything() }),
      expect.objectContaining({ title: "Pas encore analysé", ageStatus: "provisoire" }),
    ])
    expect(titles(out)).not.toContain("Pas importé")
  })
})
