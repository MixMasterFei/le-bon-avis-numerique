import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import {
  discoverTVShows,
  getTVDetails,
  getTVFrenchRating,
  getTVWatchProviders,
  mapCertificationToInternal,
  TVGenres,
  type TMDBTVDetails,
} from "@/lib/tmdb"
import { uploadTMDBPoster, uploadTMDBBackdrop } from "@/lib/supabase-storage"
import { extractProviders } from "@/lib/streaming-providers"
import { isAdultTmdbTv } from "@/lib/adult-content-filter"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// ── Pre-school TV import ───────────────────────────────────────────────
//
// The "Tout-petits" (2-4) band is the thinnest slice of the catalogue, and
// the gap is almost entirely TV: pre-school content lives in *series*
// (Peppa Pig, Bluey, T'choupi, Trotro, Pat'Patrouille…) and the catalogue had
// only ~5 of them. This sweep paginates TMDB's Kids genre (10762), keeps the
// France-available ones, and imports each new series as a provisional MediaItem
// (isEnriched:false). The nightly enrich cron then assigns the real age — the
// genuinely pre-school ones land at 3-4 (enrichment floors age at 3) and show
// up in the 2-4 band; the rest fill out 5-7.
//
// Cursor-driven, like backfill-kids:
//   POST /api/admin/import-preschool?startPage=1&pages=3&voteFloor=15[&dryRun=1]

// TV CSA code → recommended age. Pre-school Kids-genre series usually carry no
// FR cert; default them to 5 (a safe kids floor) until enrichment refines it.
function tvCertToAge(cert: string | null): number {
  if (!cert) return 5
  const map: Record<string, number> = { TP: 0, U: 0, "10": 10, "12": 12, "16": 16, "18": 18 }
  return map[cert] ?? 5
}

/** France-available: FR original, an FR content rating, or an FR streaming provider. */
async function frRelevance(details: TMDBTVDetails, frRating: string | null, tvId: number): Promise<{ ok: boolean; providers: string[] }> {
  if (details.original_language === "fr") return { ok: true, providers: [] }
  const watch = await getTVWatchProviders(tvId)
  const providers = extractProviders(watch)
  if (providers.length > 0) return { ok: true, providers }
  if (frRating) return { ok: true, providers: [] }
  if (details.content_ratings?.results?.some((r: { iso_3166_1: string }) => r.iso_3166_1 === "FR")) return { ok: true, providers: [] }
  return { ok: false, providers: [] }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startPage = Math.max(1, parseInt(searchParams.get("startPage") ?? "1"))
  const pages = Math.min(Math.max(1, parseInt(searchParams.get("pages") ?? "3")), 5)
  const voteFloor = Math.max(0, parseInt(searchParams.get("voteFloor") ?? "15"))
  const dryRun = searchParams.get("dryRun") === "1"

  const TIME_BUDGET_MS = 265_000
  const EXAMINE_CAP = 50

  const stats = {
    pagesScanned: 0,
    candidates: 0,
    examined: 0,
    imported: 0,
    skippedExisting: 0,
    skippedNoFR: 0,
    skippedAdult: 0,
    errors: 0,
  }
  const importedTitles: string[] = []
  let reachedEnd = false
  let bailedOnTime = false

  try {
    // 1. Collect candidate ids across the Kids-genre pages.
    const candidateIds: number[] = []
    for (let page = startPage; page < startPage + pages; page++) {
      try {
        const res = await discoverTVShows({
          page,
          with_genres: String(TVGenres.KIDS),
          sort_by: "popularity.desc",
          "vote_count.gte": String(voteFloor),
        })
        stats.pagesScanned++
        const results = res.results ?? []
        candidateIds.push(...results.map((s: { id: number }) => s.id))
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
          where: { type: "TV", tmdbId: { in: candidateIds } },
          select: { tmdbId: true },
        })
      ).map((m) => m.tmdbId),
    )
    const fresh = candidateIds.filter((id) => !existing.has(id))
    stats.skippedExisting = candidateIds.length - fresh.length

    // 3. Import the France-available, non-adult ones.
    for (const tvId of fresh) {
      if (Date.now() - startTime > TIME_BUDGET_MS || stats.examined >= EXAMINE_CAP) {
        bailedOnTime = Date.now() - startTime > TIME_BUDGET_MS
        break
      }
      stats.examined++
      try {
        const details = await getTVDetails(tvId)

        // Family-guide guard first.
        if (isAdultTmdbTv(details)) {
          stats.skippedAdult++
          continue
        }

        const frRating = getTVFrenchRating(details.content_ratings)
        const rel = await frRelevance(details, frRating, tvId)
        if (!rel.ok) {
          stats.skippedNoFR++
          continue
        }

        if (!dryRun) {
          const id = randomUUID()
          const [posterUrl, backdropUrl] = await Promise.all([
            uploadTMDBPoster(id, details.poster_path),
            uploadTMDBBackdrop(id, details.backdrop_path),
          ])
          await prisma.mediaItem.create({
            data: {
              id,
              tmdbId: details.id,
              title: details.name,
              originalTitle: details.original_name !== details.name ? details.original_name : null,
              type: "TV",
              releaseDate: details.first_air_date ? new Date(details.first_air_date) : null,
              releaseStatus: (details as { status?: string }).status || null,
              posterUrl,
              backdropUrl,
              synopsisFr: details.overview || null,
              officialRating: mapCertificationToInternal(frRating),
              expertAgeRec: tvCertToAge(frRating),
              numberOfSeasons: details.number_of_seasons || null,
              genres: details.genres?.map((g: { name: string }) => g.name) ?? [],
              platforms: rel.providers,
              topics: [],
              originalLanguage: details.original_language || null,
              tmdbRating: details.vote_average || null,
              tmdbVoteCount: details.vote_count || null,
              dataSource: "TMDB",
              dataQualityScore: 30,
              isEnriched: false,
              lastVerifiedAt: new Date(),
            },
          })
        }
        stats.imported++
        importedTitles.push(details.name)
        await new Promise((r) => setTimeout(r, 120))
      } catch (e) {
        console.error(`[import-preschool] Import failed for tmdbId=${tvId}:`, e instanceof Error ? e.message : e)
        stats.errors++
      }
    }

    const done = reachedEnd && !bailedOnTime && stats.examined >= fresh.length
    const nextPage = done ? null : startPage + stats.pagesScanned

    await logCronRun({
      task: "import-preschool",
      status: stats.errors > 5 ? "partial" : "success",
      summary: `${stats.imported} séries jeunesse importées (pages ${startPage}-${startPage + stats.pagesScanned - 1})`,
      details: { ...stats, done, nextPage, dryRun },
      startTime,
    })

    return NextResponse.json({ success: true, dryRun, done, nextPage, voteFloor, stats, importedTitles })
  } catch (error) {
    await logCronRun({
      task: "import-preschool",
      status: "error",
      summary: error instanceof Error ? error.message : "import-preschool failed",
      startTime,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import-preschool failed" },
      { status: 500 },
    )
  }
}
