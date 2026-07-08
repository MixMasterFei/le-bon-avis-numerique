import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import {
  getRecentGames,
  getPopularGames,
  getIGDBImageUrl,
  getPegiInfo,
  normalizePlatforms,
  type IGDBGame,
} from "@/lib/igdb"
import { normalizeGameGenres } from "@/lib/igdb-genres"
import { isAdultIgdbGame } from "@/lib/adult-content-filter"
import { deriveGameStyleTags } from "@/lib/game-style-tags"

export const maxDuration = 60

// Weekly games import — analogous to /api/cron/weekly-import for
// movies & TV. Pulls fresh IGDB releases (and a top-up from popular
// games to catch anything we don't have yet), dedups against existing
// igdbIds, and persists them with isEnriched=false so the daily
// enrich cron picks them up on the next run.
//
// Hard rule (matches the homepage rail and /jeux releaseDate filter):
// only import games with a meaningful IGDB rating count. The IGDB
// helpers already enforce this (getRecentGames > 20, getPopularGames
// > 100) AND we apply a defensive floor here in case those helpers'
// thresholds get loosened later. Keeps obscure indie shovelware
// (Fly for Fly, Zen Wash, etc.) out of the catalog at the source —
// no point importing what we'd then have to filter out everywhere.

const MIN_VOTE_COUNT = 20
const MAX_IMPORT_PER_RUN = 25 // Vercel 60s ceiling — each Prisma create
                              // is fast but the IGDB fetches dominate;
                              // 25 fits with comfortable headroom.

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  ) {
    return true
  }
  return false
}

interface ImportStats {
  fetched: number
  alreadyHad: number
  belowThreshold: number
  imported: number
  errors: number
}

function transformGame(game: IGDBGame) {
  const pegi = getPegiInfo(game.age_ratings)
  const developer = game.involved_companies?.find((c) => c.developer)
  const ageRec = pegi?.age ?? null
  return {
    igdbId: game.id,
    title: game.name,
    type: "GAME" as const,
    synopsisFr: game.summary || game.storyline || null,
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "large"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    genres: normalizeGameGenres(game.genres?.map((g) => g.name) || []),
    platforms: normalizePlatforms(game.platforms),
    officialRating: pegi?.internal || null,
    pegiDescriptors: pegi?.descriptors ?? [],
    expertAgeRec: ageRec,
    director: developer?.company.name || null, // IGDB developer → director field (per existing manual import convention)
    // Steam-style tags (Pixel art, Roguelike, JRPG, 2D/3D, MMO…) from IGDB
    // metadata — replaces the raw English theme names. See game-style-tags.ts.
    topics: deriveGameStyleTags(game),
    tmdbRating: game.total_rating ? Math.round(game.total_rating) / 10 : null,
    tmdbVoteCount: game.total_rating_count || null,
    dataSource: "IGDB" as const,
    // Mirrors the movie/TV import scoring: anything with an age rating
    // gets a baseline of 30 (poster + age + genre is enough to surface
    // in browse). No age → 10 so it sinks until enrichment fills in
    // the gaps. Daily enrich cron will bump it later.
    dataQualityScore: ageRec ? 30 : 10,
    isEnriched: false,
    lastVerifiedAt: new Date(),
  }
}

async function importBatch(
  games: IGDBGame[],
  source: string,
  remainingBudget: number,
  stats: ImportStats,
): Promise<number> {
  if (remainingBudget <= 0 || games.length === 0) return 0

  // Defensive popularity floor — IGDB helpers already filter, but
  // re-check here so loosening their thresholds doesn't flood the
  // catalog with shovelware.
  const eligible = games.filter((g) => {
    if (!g.cover?.image_id) return false
    const count = g.total_rating_count ?? 0
    if (count < MIN_VOTE_COUNT) {
      stats.belowThreshold++
      return false
    }
    return true
  })

  // Skip games we already have (by IGDB id).
  const ids = eligible.map((g) => g.id)
  if (ids.length === 0) return 0
  const existing = new Set(
    (
      await prisma.mediaItem.findMany({
        where: { igdbId: { in: ids } },
        select: { igdbId: true },
      })
    ).map((m) => m.igdbId),
  )
  const fresh = eligible.filter((g) => !existing.has(g.id))
  stats.alreadyHad += eligible.length - fresh.length

  let imported = 0
  for (const game of fresh.slice(0, remainingBudget)) {
    try {
      // Family-guide guard: never import erotic / adult-only games.
      if (isAdultIgdbGame(game)) {
        console.warn(`[weekly-games-import] skipped adult game: "${game.name}"`)
        continue
      }
      const data = transformGame(game)
      await prisma.mediaItem.create({
        data: {
          ...data,
          originalTitle: null,
          backdropUrl: null,
          duration: null,
          communityAgeRec: null,
        },
      })
      imported++
      stats.imported++
    } catch (err) {
      stats.errors++
      console.warn(`[weekly-games-import] ${source} create failed for "${game.name}":`, err)
    }
  }
  return imported
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const stats: ImportStats = {
    fetched: 0,
    alreadyHad: 0,
    belowThreshold: 0,
    imported: 0,
    errors: 0,
  }
  const sources: Record<string, number> = {}

  try {
    // Recent releases first — IGDB filter is `first_release_date in
    // last 6 months` AND `total_rating_count > 20`. Most weeks this
    // produces 5-15 genuinely new games to surface on the homepage rail.
    const recent = await getRecentGames(80)
    stats.fetched += recent.length
    sources.recent = await importBatch(
      recent,
      "recent",
      MAX_IMPORT_PER_RUN - stats.imported,
      stats,
    )

    // Top-up from popular games — catches catalog gaps where a
    // mainstream title (e.g. an older but still-popular Switch game)
    // never made it into our DB. IGDB filter here is `> 100` ratings
    // so only well-established titles survive.
    if (stats.imported < MAX_IMPORT_PER_RUN) {
      const popular = await getPopularGames(80)
      stats.fetched += popular.length
      sources.popular = await importBatch(
        popular,
        "popular",
        MAX_IMPORT_PER_RUN - stats.imported,
        stats,
      )
    }

    const duration = Math.round((Date.now() - startTime) / 1000)

    await logCronRun({
      task: "import-games",
      status: stats.errors > 0 ? "partial" : "success",
      summary: `${stats.imported} jeux importés (${stats.alreadyHad} déjà en base, ${stats.belowThreshold} sous seuil) en ${duration}s`,
      details: { ...stats, sources, MIN_VOTE_COUNT, MAX_IMPORT_PER_RUN },
      startTime,
    })

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      stats,
      sources,
    })
  } catch (err) {
    console.error("[weekly-games-import] failed:", err)
    await logCronRun({
      task: "import-games",
      status: "error",
      summary: err instanceof Error ? err.message : "Import failed",
      details: { ...stats },
      startTime,
    })
    return NextResponse.json(
      { error: "Import failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    )
  }
}
