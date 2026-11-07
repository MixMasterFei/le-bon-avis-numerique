import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized: vi.fn() }))
vi.mock("@/lib/cron-log", () => ({ logCronRun: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() }, $executeRaw: vi.fn() },
}))
vi.mock("@/lib/tmdb", () => ({ getMovieDetails: vi.fn(), getTVDetails: vi.fn() }))
// The REAL selection and refresh loop — only the 150 ms courtesy pause between
// two TMDB calls is dropped, so a dozen simulated Saturdays run instantly.
vi.mock("@/lib/tmdb-refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb-refresh")>()
  return {
    ...actual,
    refreshFromTmdb: (...[rows, opts]: Parameters<typeof actual.refreshFromTmdb>) =>
      actual.refreshFromTmdb(rows, { ...opts, delayMs: 0 }),
  }
})

import { POST } from "@/app/api/admin/backfill-ratings/route"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { recentReleaseVotesWhere } from "@/lib/tmdb-refresh"
import { matchesWhere } from "@/test/prisma-where"

/**
 * Simulates the Saturday « Backfill TMDB ratings » step over several weeks:
 * an in-memory media_items table answers the route's real Prisma predicates,
 * TMDB answers from a per-title script, and each Saturday runs the same loop as
 * .github/workflows/cron.yml (call until remaining = 0 or no progress, max 35).
 */

const db = vi.mocked(prisma, true)

interface Row {
  id: string
  title: string
  type: "MOVIE" | "TV"
  tmdbId: number | null
  releaseStatus: string | null
  releaseDate: Date | null
  tmdbRating: number | null
  tmdbVoteCount: number | null
  tmdbCheckedAt: Date | null
}

type Answer = { votes: number; rating: number } | Error

let table: Row[]
let script: Map<number, Answer[]>
let reads: number[]

const byId = (id: string) => table.find((r) => r.id === id)!

function addRow(over: Partial<Row> & Pick<Row, "id" | "tmdbId" | "releaseDate">): Row {
  const row: Row = {
    title: over.id,
    type: "MOVIE",
    releaseStatus: "Released",
    tmdbRating: 6,
    tmdbVoteCount: 5,
    tmdbCheckedAt: null,
    ...over,
  }
  table.push(row)
  return row
}

/** What TMDB answers for a title from now on; a list is consumed in order, its last answer sticks. */
function tmdbSays(tmdbId: number, ...answers: Answer[]) {
  script.set(tmdbId, answers)
}

async function tmdbDetails(tmdbId: number) {
  reads.push(tmdbId)
  const answers = script.get(tmdbId) ?? [{ votes: 0, rating: 0 }]
  const answer = answers.length > 1 ? answers.shift()! : answers[0]
  if (answer instanceof Error) throw answer
  return { status: "Released", vote_count: answer.votes, vote_average: answer.rating }
}

const readsOf = (tmdbId: number) => reads.filter((id) => id === tmdbId).length

const at = (iso: string) => new Date(`${iso}T05:19:00Z`)

/** One Saturday 05:19 run, looped like the workflow step. */
async function saturday(iso: string) {
  vi.setSystemTime(at(iso))
  for (let batch = 0; batch < 35; batch++) {
    const json = await (await POST(new NextRequest("http://localhost/api/admin/backfill-ratings", { method: "POST" }))).json()
    if (json.remaining === 0) break
    if (json.updated === 0 && json.unratable === 0) break
  }
}

// The vote gates the lists apply (media-queries.ts, collections-data.ts,
// recommendations/family, expert-picks.ts…).
const GATES = { annee: 20, qualite: 50, famille: 100, une: 200, selection: 500 } as const
const openGates = (row: Row) =>
  Object.entries(GATES)
    .filter(([, min]) => matchesWhere({ ...row }, { tmdbVoteCount: { gte: min } }))
    .map(([name]) => name)

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  table = []
  script = new Map()
  reads = []

  vi.mocked(isCronOrAdminAuthorized).mockResolvedValue(true)
  vi.mocked(getMovieDetails).mockImplementation(tmdbDetails as never)
  vi.mocked(getTVDetails).mockImplementation(tmdbDetails as never)
  db.mediaItem.findMany.mockImplementation((async (args: { where: Record<string, unknown>; take: number }) =>
    table.filter((r) => matchesWhere({ ...r }, args.where)).slice(0, args.take).map((r) => ({ ...r }))) as never)
  db.mediaItem.count.mockImplementation((async (args: { where: Record<string, unknown> }) =>
    table.filter((r) => matchesWhere({ ...r }, args.where)).length) as never)
  db.mediaItem.update.mockImplementation((async (args: { where: { id: string }; data: Partial<Row> }) =>
    Object.assign(byId(args.where.id), args.data)) as never)
  db.$executeRaw.mockImplementation((async (sql: TemplateStringsArray, id: string) => {
    expect(sql.join("?")).toContain("SET tmdb_checked_at = now()")
    byId(id).tmdbCheckedAt = new Date()
    return 1
  }) as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Saturday ratings backfill — recent releases, run after run", () => {
  it("follows a film from 0 to 5 to 200 votes until every gate is open, then stops asking", async () => {
    // Imported before release: TMDB had no vote, the import stored null/null.
    const film = addRow({ id: "petit-prince-2", tmdbId: 9001, releaseDate: new Date("2026-11-04"), tmdbRating: null, tmdbVoteCount: null })

    // Out since Wednesday; TMDB has genuinely no vote yet — stored as 0, cursor moved.
    tmdbSays(9001, { votes: 0, rating: 0 })
    await saturday("2026-11-07")
    expect(film).toMatchObject({ tmdbVoteCount: 0, tmdbRating: 0, tmdbCheckedAt: at("2026-11-07") })
    expect(readsOf(9001)).toBe(1) // a genuine 0 is not re-asked within the same run

    tmdbSays(9001, { votes: 5, rating: 7.1 })
    await saturday("2026-11-14")
    expect(film.tmdbVoteCount).toBe(5)

    // 5 votes: the old zero-vote queue let go of it here. Still followed weekly.
    tmdbSays(9001, { votes: 60, rating: 7.3 })
    await saturday("2026-11-21")
    expect(film.tmdbVoteCount).toBe(60)
    expect(openGates(film)).toEqual(["annee", "qualite"])

    tmdbSays(9001, { votes: 200, rating: 7.4 })
    await saturday("2026-11-28")
    expect(film.tmdbVoteCount).toBe(200)
    expect(openGates(film)).toEqual(["annee", "qualite", "famille", "une"])

    tmdbSays(9001, { votes: 520, rating: 7.4 })
    await saturday("2026-12-05")
    expect(openGates(film)).toEqual(["annee", "qualite", "famille", "une", "selection"])
    expect(readsOf(9001)).toBe(5) // exactly one TMDB read per Saturday

    // Past the highest gate: retired, TMDB is no longer asked.
    tmdbSays(9001, { votes: 700, rating: 7.5 })
    await saturday("2026-12-12")
    await saturday("2026-12-19")
    expect(readsOf(9001)).toBe(5)
    expect(film.tmdbVoteCount).toBe(520)
  })

  it("keeps a TMDB failure due — nothing written, run reported partial — and the next run retries it", async () => {
    const film = addRow({ id: "f", tmdbId: 9002, releaseDate: new Date("2026-10-20"), tmdbVoteCount: 5, tmdbCheckedAt: at("2026-10-31") })

    tmdbSays(9002, new Error("TMDB request timeout after 10 seconds"))
    await saturday("2026-11-07")
    expect(readsOf(9002)).toBe(1) // the loop stops on a batch without progress, no hammering
    expect(film).toMatchObject({ tmdbVoteCount: 5, tmdbCheckedAt: at("2026-10-31") })
    expect(vi.mocked(logCronRun)).toHaveBeenLastCalledWith(
      expect.objectContaining({ task: "backfill-ratings", status: "partial", details: expect.objectContaining({ errors: 1 }) }),
    )
    // Still due mid-week: the failure did not buy it a week off.
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"))
    expect(matchesWhere({ ...film }, recentReleaseVotesWhere(new Date()) as Record<string, unknown>)).toBe(true)

    tmdbSays(9002, { votes: 140, rating: 6.9 })
    await saturday("2026-11-14")
    expect(film).toMatchObject({ tmdbVoteCount: 140, tmdbCheckedAt: at("2026-11-14") })
  })

  it("retries a failure in the next batch of the same run when the run is still making progress", async () => {
    const shaky = addRow({ id: "shaky", tmdbId: 9003, releaseDate: new Date("2026-10-20") })
    const steady = addRow({ id: "steady", tmdbId: 9004, releaseDate: new Date("2026-10-21") })
    tmdbSays(9003, new Error("TMDB API error: 503 Service Unavailable"), { votes: 33, rating: 6.4 })
    tmdbSays(9004, { votes: 12, rating: 5.8 })

    await saturday("2026-11-07")

    expect(readsOf(9003)).toBe(2)
    expect(readsOf(9004)).toBe(1)
    expect(shaky.tmdbVoteCount).toBe(33)
    expect(steady.tmdbVoteCount).toBe(12)

    // A success is not re-read before its cadence…
    await saturday("2026-11-08")
    expect(reads).toHaveLength(3)
    // …and is re-read the week after.
    await saturday("2026-11-14")
    expect(readsOf(9003)).toBe(3)
    expect(readsOf(9004)).toBe(2)
  })

  it("ages: weekly until day 90, every four weeks until day 365, then retired; zero-vote catch-up once", async () => {
    // A series out 129 days ago (monthly cadence), with 40 votes.
    addRow({ id: "serie", type: "TV", tmdbId: 9010, releaseDate: new Date("2026-07-01"), tmdbVoteCount: 40 })
    // Out more than a year ago: retired, whatever its count.
    addRow({ id: "old", tmdbId: 9011, releaseDate: new Date("2025-09-01"), tmdbVoteCount: 40 })
    // Out long ago, still at 0 and never re-read since import: read once.
    addRow({ id: "old-zero", tmdbId: 9012, releaseDate: new Date("2025-06-01"), tmdbRating: 0, tmdbVoteCount: 0 })
    // Recent but already past the highest gate: retired.
    addRow({ id: "hit", tmdbId: 9013, releaseDate: new Date("2026-10-20"), tmdbVoteCount: 900 })
    tmdbSays(9010, { votes: 41, rating: 7 })
    tmdbSays(9012, { votes: 0, rating: 0 })

    for (const day of ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28", "2026-12-05"]) await saturday(day)

    expect(readsOf(9010)).toBe(2) // 2026-11-07, then four weeks later on 2026-12-05
    expect(readsOf(9011)).toBe(0)
    expect(readsOf(9012)).toBe(1)
    expect(readsOf(9013)).toBe(0)
  })
})
