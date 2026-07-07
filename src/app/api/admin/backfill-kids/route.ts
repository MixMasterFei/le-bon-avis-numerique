import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import {
  discoverMovies,
  getMovieDetails,
  getFrenchCertification,
  getMovieWatchProviders,
  MovieGenres,
  type TMDBMovieDetails,
} from "@/lib/tmdb"
import { createMovieFromTmdb, estimateProvisionalAge } from "@/lib/import-helpers"
import { isAdultTmdbMovie } from "@/lib/adult-content-filter"
import { extractProviders } from "@/lib/streaming-providers"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// ── Young-kids catalogue backfill ─────────────────────────────────────
//
// The small-kids segment (≤6 ans) is the thinnest part of the movie
// catalogue (~930 films, ~13%) despite being the highest-demand slice of a
// family guide. The daily import only advances ONE TMDB page/week on the
// family/animation sources and re-fetches the same blockbusters, so it
// trickles ~4 new items/day — far too slow to close the gap. This route
// paginates DEEP through TMDB's animation/family catalogue in one sweep and
// imports every new, French-relevant title whose provisional age is ≤ maxAge.
//
// Imports land as provisional (isEnriched:false, estimated age + day-one
// platforms) — visible in search / age browse / newest immediately; the
// nightly enrich cron upgrades them to full fiches over time. A vote floor
// keeps the sweep on real films, not obscure noise.
//
// Cursor-driven: a loop caller advances startPage until done. Rotate `mode`
// across passes for breadth.
//   POST /api/admin/backfill-kids?mode=anim_family&startPage=1&pages=3&maxAge=8&voteFloor=30[&dryRun=1]

type Mode = "anim_family" | "animation" | "family"

const MODES: Mode[] = ["anim_family", "animation", "family"]

/** French relevance: French original, an FR certification, or an FR release. */
function hasFrenchRelevance(details: TMDBMovieDetails, frCert: string | null): boolean {
  if (details.original_language === "fr") return true
  if (frCert) return true
  if (details.release_dates?.results?.some((r: { iso_3166_1: string }) => r.iso_3166_1 === "FR")) return true
  return false
}

function discoverForMode(mode: Mode, page: number, voteFloor: number) {
  switch (mode) {
    case "animation":
      return discoverMovies({
        page,
        with_genres: MovieGenres.ANIMATION.toString(),
        sort_by: "popularity.desc",
        "vote_count.gte": String(voteFloor),
      })
    case "family":
      return discoverMovies({
        page,
        with_genres: MovieGenres.FAMILY.toString(),
        sort_by: "popularity.desc",
        "vote_count.gte": String(voteFloor),
      })
    case "anim_family":
    default:
      // Both genres (TMDB comma = AND) → the core small-kids bucket.
      return discoverMovies({
        page,
        with_genres: `${MovieGenres.ANIMATION},${MovieGenres.FAMILY}`,
        sort_by: "popularity.desc",
        "vote_count.gte": String(voteFloor),
      })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mode = (MODES.includes(searchParams.get("mode") as Mode) ? searchParams.get("mode") : "anim_family") as Mode
  const startPage = Math.max(1, parseInt(searchParams.get("startPage") ?? "1"))
  const pages = Math.min(Math.max(1, parseInt(searchParams.get("pages") ?? "3")), 5)
  const maxAge = Math.min(Math.max(0, parseInt(searchParams.get("maxAge") ?? "8")), 18)
  const voteFloor = Math.max(0, parseInt(searchParams.get("voteFloor") ?? "30"))
  const dryRun = searchParams.get("dryRun") === "1"

  // Safety bail before the 300s ceiling — each import costs ~0.4-0.6s
  // (detail + providers + poster upload). Leaves headroom to serialize.
  const TIME_BUDGET_MS = 265_000
  // Cap candidate detail-fetches per call so a dense page range can't blow
  // the budget; the caller loops for more.
  const EXAMINE_CAP = 60

  const stats = {
    mode,
    pagesScanned: 0,
    candidates: 0,
    examined: 0,
    imported: 0,
    skippedExisting: 0,
    skippedAge: 0,
    skippedNoFR: 0,
    skippedAdult: 0,
    errors: 0,
  }
  const importedTitles: Array<{ title: string; age: number }> = []
  let reachedEnd = false
  let bailedOnTime = false

  try {
    // 1. Collect candidate ids across the page range.
    const candidateIds: number[] = []
    for (let page = startPage; page < startPage + pages; page++) {
      try {
        const res = await discoverForMode(mode, page, voteFloor)
        stats.pagesScanned++
        const results = res.results ?? []
        candidateIds.push(...results.map((m: { id: number }) => m.id))
        // TMDB ran out of results (or hit its 500-page ceiling).
        if (results.length === 0 || page >= (res.total_pages ?? 500)) {
          reachedEnd = true
          break
        }
      } catch {
        stats.errors++
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    stats.candidates = candidateIds.length

    // 2. Drop the ones we already have.
    const existing = new Set(
      (
        await prisma.mediaItem.findMany({
          where: { type: "MOVIE", tmdbId: { in: candidateIds } },
          select: { tmdbId: true },
        })
      ).map((m) => m.tmdbId),
    )
    const fresh = candidateIds.filter((id) => !existing.has(id))
    stats.skippedExisting = candidateIds.length - fresh.length

    // 3. Import the young, French-relevant ones.
    for (const tmdbId of fresh) {
      if (Date.now() - startTime > TIME_BUDGET_MS || stats.examined >= EXAMINE_CAP) {
        bailedOnTime = Date.now() - startTime > TIME_BUDGET_MS
        break
      }
      stats.examined++
      try {
        const details = await getMovieDetails(tmdbId)

        // Family-guide guard — never let a young-kids sweep pull in an adult
        // OVA that TMDB tags "Animation" (the very risk this deep sweep runs).
        if (isAdultTmdbMovie(details)) {
          stats.skippedAdult++
          continue
        }

        const frCert = getFrenchCertification(details.release_dates)

        // FR relevance — allow a watch-provider fallback (an FR-streamable
        // title even without an FR theatrical entry counts).
        let watch: Awaited<ReturnType<typeof getMovieWatchProviders>> | undefined
        let isFR = hasFrenchRelevance(details, frCert)
        if (!isFR) {
          watch = await getMovieWatchProviders(tmdbId)
          isFR = watch !== null
        }
        if (!isFR) {
          stats.skippedNoFR++
          continue
        }

        // Age gate — this is the whole point: only small-kids titles.
        const { age } = estimateProvisionalAge(details)
        if (age > maxAge) {
          stats.skippedAge++
          continue
        }

        if (!dryRun) {
          if (watch === undefined) watch = await getMovieWatchProviders(tmdbId)
          await createMovieFromTmdb(details, { providers: extractProviders(watch) })
        }
        stats.imported++
        importedTitles.push({ title: details.title, age })
        await new Promise((r) => setTimeout(r, 120))
      } catch {
        stats.errors++
      }
    }

    // done when we exhausted the catalogue AND processed everything we pulled
    // without bailing — otherwise hand the caller the next page to continue.
    const done = reachedEnd && !bailedOnTime && stats.examined >= fresh.length
    const nextPage = done ? null : startPage + stats.pagesScanned

    await logCronRun({
      task: "backfill-kids",
      status: stats.errors > 5 ? "partial" : "success",
      summary: `${stats.imported} jeunes titres importés (mode=${mode}, âge≤${maxAge}, pages ${startPage}-${startPage + stats.pagesScanned - 1})`,
      details: { ...stats, done, nextPage, dryRun },
      startTime,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      done,
      nextPage,
      maxAge,
      voteFloor,
      stats,
      importedTitles,
    })
  } catch (error) {
    await logCronRun({
      task: "backfill-kids",
      status: "error",
      summary: error instanceof Error ? error.message : "backfill-kids failed",
      startTime,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "backfill-kids failed" },
      { status: 500 },
    )
  }
}
