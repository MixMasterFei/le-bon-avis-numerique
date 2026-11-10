// @vitest-environment node
/**
 * The recommendation tools enforce the audience's age window and the type
 * the parent asked for, whatever the model passes (baseline 2026-11-08:
 * Minecraft Dungeons II 8+ for a group with a 6-year-old, Piper / Peppa Pig
 * for teens, Peppa Pig and Mario Kart 8 when a FILM was asked for).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ mediaFindMany: vi.fn(), fetch: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: async () => [] },
    mediaReaction: { findMany: async () => [] },
    mediaItem: { findMany: h.mediaFindMany },
  },
}))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: async () => ["m-dp"], matchMediaIdsByTheme: async () => [] }))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { buildTotemTools } from "../totem/tools"
import { inferTurnHints } from "../totem/turn-hints"

const FAMILY = [
  { name: "Léa", age: 6 },
  { name: "Hugo", age: 10 },
  { name: "Inès", age: 14 },
]
const opts = { toolCallId: "c", messages: [] }
type Exec = (input: unknown, o: typeof opts) => Promise<Record<string, unknown>>

function tools(userText: string, priorUserTexts: string[] = [], shownMediaIds?: Set<string>) {
  const hints = inferTurnHints({ userText, priorUserTexts, family: FAMILY })
  const t = buildTotemTools({ origin: "http://x", cookieHeader: null, userId: "u", hints, shownMediaIds })
  return {
    search: (input: unknown) => (t.searchMedia.execute as unknown as Exec)(input, opts),
    rail: (input: unknown) => (t.getDiscoveryRail.execute as unknown as Exec)(input, opts),
  }
}
const lastQuery = () => h.mediaFindMany.mock.calls.at(-1)![0] as { where: Record<string, unknown>; orderBy: unknown[] }

beforeEach(() => {
  vi.clearAllMocks()
  h.mediaFindMany.mockResolvedValue([])
  vi.stubGlobal("fetch", h.fetch)
})

describe("age window", () => {
  it("caps a game for Hugo and Léa at Léa's age, even when the model passes Hugo's", async () => {
    await tools("Un jeu vidéo à faire ensemble avec Hugo et Léa ?").rail({ rail: "recent-games", age: 10, limit: 6 })
    expect(lastQuery().where).toMatchObject({ type: "GAME", expertAgeRec: { lte: 6, gte: 0 } })
  })

  it("keeps toddler titles out of a teen night and ranks the closest ages first", async () => {
    const t = tools("Soirée film à la maison pour Inès et sa copine de 15 ans, une idée ?")
    await t.rail({ rail: "by-age", age: 15, limit: 6 })
    expect(lastQuery().where).toMatchObject({ type: "MOVIE", expertAgeRec: { lte: 14, gte: 9 } })
    expect(lastQuery().orderBy[0]).toEqual({ expertAgeRec: "desc" })
    await t.search({ maxAge: 15, genre: "Comédie", limit: 5 })
    expect(lastQuery().where).toMatchObject({ type: "MOVIE", expertAgeRec: { gte: 9, lte: 14 } })
    expect(lastQuery().orderBy[0]).toEqual({ expertAgeRec: "desc" })
  })

  it("caps a rail for Hugo and Inès at 10 with a floor of 5", async () => {
    await tools("Un film ce soir à la maison avec Hugo et Inès ?").rail({ rail: "by-age", age: 14, limit: 6 })
    expect(lastQuery().where).toMatchObject({ expertAgeRec: { lte: 10, gte: 5 } })
  })

  it("follows a sibling who joins mid-conversation", async () => {
    await tools("Finalement Léa regarde avec nous.", ["Un film pour Hugo ce soir à la maison ?"]).search({ maxAge: 10, limit: 5 })
    expect(lastQuery().where).toMatchObject({ expertAgeRec: { lte: 6 } })
  })

  it("never filters a by-title lookup", async () => {
    await tools("Hugo peut-il regarder Deadpool ?").search({ q: "Deadpool", limit: 3 })
    expect(lastQuery().where.expertAgeRec).toBeUndefined()
    expect(lastQuery().where.type).toEqual({ not: "MANGA" })
  })
})

describe("requested type", () => {
  it("returns films when a film is asked for, whatever the model passes", async () => {
    const t = tools("Vous me conseillez un film pour Hugo ce soir à la maison ?")
    await t.search({ type: "GAME", maxAge: 10, limit: 5 })
    expect(lastQuery().where.type).toBe("MOVIE")
    await t.rail({ rail: "by-age", age: 10 })
    expect(lastQuery().where.type).toBe("MOVIE")
  })

  it("uses a carried-over type only as a default", async () => {
    const t = tools("Un autre ?", ["Un film pour Hugo ce soir à la maison ?"])
    await t.search({ maxAge: 10, limit: 5 })
    expect(lastQuery().where.type).toBe("MOVIE")
    await t.search({ type: "GAME", maxAge: 10, limit: 5 })
    expect(lastQuery().where.type).toBe("GAME")
    const out = await t.rail({ rail: "recent-games", age: 10 })
    expect(out.status).toBe("ok")
  })

  it("refuses a games rail when a film was asked for", async () => {
    const out = await tools("Un film pour Hugo ?").rail({ rail: "recent-games", age: 10 })
    expect(out.status).toBe("type_mismatch")
    expect(h.mediaFindMany).not.toHaveBeenCalled()
  })

  it("keeps the film rails on films by default (no more series or games in them)", async () => {
    await tools("Une idée pour ce soir ?").rail({ rail: "by-genre", genre: "Animation", age: 6 })
    expect(lastQuery().where.type).toBe("MOVIE")
  })

  it("applies the window to the cinema rail", async () => {
    h.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        movies: [
          { id: "a", title: "Pour les petits", expertAgeRec: 3, genres: [], releaseDate: "2026-11-01", inDatabase: true },
          { id: "b", title: "Pour Hugo", expertAgeRec: 10, genres: [], releaseDate: "2026-11-01", inDatabase: true },
          { id: "c", title: "Trop vieux", expertAgeRec: 14, genres: [], releaseDate: "2026-11-01", inDatabase: true },
        ],
      }),
    })
    const out = await tools("Qu'est-ce qu'on peut voir au cinéma avec Hugo et Inès ?").rail({ rail: "cinema" })
    expect((out.results as Array<{ title: string }>).map((r) => r.title)).toEqual(["Pour Hugo"])
    expect(out.seeAllUrl).toBe("/films?sort=cinema&maxAge=10")
  })
})

describe("already shown in the conversation", () => {
  const shown = new Set(["m-piper", "m-winnie"])

  it("never returns them from a recommendation", async () => {
    const t = tools("Un autre ?", ["Un dessin animé pour Léa ?"], shown)
    await t.rail({ rail: "by-age", age: 6 })
    expect(lastQuery().where.NOT).toEqual({ id: { in: ["m-piper", "m-winnie"] } })
    const out = await t.search({ maxAge: 6, genre: "Animation", limit: 5 })
    expect(lastQuery().where.NOT).toEqual({ id: { in: ["m-piper", "m-winnie"] } })
    expect(out.alreadyShownExcluded).toBeDefined()
  })

  it("still finds them by title", async () => {
    await tools("Et Piper, c'est pour quel âge ?", [], shown).search({ q: "Piper", limit: 3 })
    expect(lastQuery().where.NOT).toBeUndefined()
  })
})
