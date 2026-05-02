import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import {
  getPopularMovies,
  getNowPlayingMovies,
  discoverMovies,
  getMovieDetails,
  getFrenchCertification,
  getDirector,
  MovieGenres,
  mapCertificationToInternal,
  getPopularTVShows,
  getTVDetails,
  getTVFrenchRating,
  getMovieWatchProviders,
  getTVWatchProviders,
  TMDBMovieDetails,
  TMDBTVDetails,
} from "@/lib/tmdb"
import {
  uploadTMDBPoster,
  uploadTMDBBackdrop,
  isImageUrlValid,
  uploadPoster,
  isStorageEnabled,
} from "@/lib/supabase-storage"

export const maxDuration = 60

// Map French CSA certification to recommended age
function certificationToAge(cert: string | null): number | null {
  if (!cert) return null
  const map: Record<string, number> = { U: 0, TP: 0, "10": 10, "12": 12, "16": 16, "18": 18 }
  return map[cert] ?? null
}

// Verify Vercel Cron Secret
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Development bypass requires an explicit opt-in flag — see
  // weekly-dossier for the rationale (tunnel-exposed `next dev`).
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  ) {
    return true
  }
  return false
}

interface ImportStats {
  total: number
  imported: number
  skipped: number
  skippedNoFR: number
  errors: number
}

// Check if a movie has French relevance (FR release, FR streaming, or French language)
function hasMovieFrenchRelevance(
  details: TMDBMovieDetails,
  frCert: string | null
): boolean {
  // 1. French language original
  if (details.original_language === "fr") return true
  // 2. Has French certification (means it was released in France)
  if (frCert) return true
  // 3. Has FR release date entry (even without certification)
  if (details.release_dates?.results?.some((r: { iso_3166_1: string }) => r.iso_3166_1 === "FR")) return true
  return false
}

// Check if a TV show has French relevance
function hasTVFrenchRelevance(
  details: TMDBTVDetails,
  frRating: string | null
): boolean {
  if (details.original_language === "fr") return true
  if (frRating) return true
  if (details.content_ratings?.results?.some((r: { iso_3166_1: string }) => r.iso_3166_1 === "FR")) return true
  return false
}

async function importMoviesFromSource(
  source: "popular" | "now_playing" | "family" | "animation",
  pages: number
): Promise<ImportStats> {
  const stats: ImportStats = { total: 0, imported: 0, skipped: 0, skippedNoFR: 0, errors: 0 }

  // Fetch movie IDs from TMDB
  const allMovies: Array<{ id: number; title: string }> = []
  for (let page = 1; page <= pages; page++) {
    try {
      let response
      switch (source) {
        case "now_playing":
          response = await getNowPlayingMovies(page)
          break
        case "family":
          response = await discoverMovies({
            page,
            with_genres: MovieGenres.FAMILY.toString(),
            sort_by: "popularity.desc",
          })
          break
        case "animation":
          response = await discoverMovies({
            page,
            with_genres: MovieGenres.ANIMATION.toString(),
            sort_by: "popularity.desc",
          })
          break
        default:
          response = await getPopularMovies(page)
      }
      allMovies.push(...response.results.map((m: { id: number; title: string }) => ({ id: m.id, title: m.title })))
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch {
      // Continue on page errors
    }
  }

  stats.total = allMovies.length

  // Skip existing movies
  const existingTmdbIds = new Set(
    (await prisma.mediaItem.findMany({
      where: { type: "MOVIE", tmdbId: { in: allMovies.map((m) => m.id) } },
      select: { tmdbId: true },
    })).map((m) => m.tmdbId)
  )
  const newMovies = allMovies.filter((m) => !existingTmdbIds.has(m.id))
  stats.skipped = stats.total - newMovies.length

  // Import new movies (limit to 20 per run to stay within timeout)
  for (const movie of newMovies.slice(0, 20)) {
    try {
      const details = await getMovieDetails(movie.id)
      const frCert = getFrenchCertification(details.release_dates)

      // Skip movies with no French relevance
      let isFR = hasMovieFrenchRelevance(details, frCert)
      if (!isFR) {
        // Last resort: check if available on French streaming platforms
        const frProviders = await getMovieWatchProviders(movie.id)
        isFR = frProviders !== null
      }
      if (!isFR) {
        stats.skippedNoFR++
        continue
      }

      const director = getDirector(details.credits)
      const internalRating = mapCertificationToInternal(frCert)
      const ageRec = certificationToAge(frCert)

      const genres = details.genres?.map((g: { id: number; name: string }) => g.name) || []
      const releaseDate = details.release_date ? new Date(details.release_date) : null

      // Pre-generate ID so we can upload images with deterministic paths
      const id = randomUUID()
      const [posterUrl, backdropUrl] = await Promise.all([
        uploadTMDBPoster(id, details.poster_path),
        uploadTMDBBackdrop(id, details.backdrop_path),
      ])

      await prisma.mediaItem.create({
        data: {
          id,
          tmdbId: details.id,
          title: details.title,
          originalTitle: details.original_title !== details.title ? details.original_title : null,
          type: "MOVIE",
          releaseDate,
          posterUrl,
          backdropUrl,
          synopsisFr: details.overview || null,
          officialRating: internalRating,
          expertAgeRec: ageRec,
          duration: details.runtime || null,
          director: director || null,
          genres,
          platforms: [],
          topics: [],
          originalLanguage: details.original_language || null,
          tmdbRating: details.vote_average || null,
          tmdbVoteCount: details.vote_count || null,
          dataSource: "TMDB",
          dataQualityScore: ageRec ? 30 : 10,
          isEnriched: false,
          lastVerifiedAt: new Date(),
        },
      })
      stats.imported++
      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch {
      stats.errors++
    }
  }

  return stats
}

async function importTVFromSource(pages: number): Promise<ImportStats> {
  const stats: ImportStats = { total: 0, imported: 0, skipped: 0, skippedNoFR: 0, errors: 0 }

  const allShows: Array<{ id: number; name: string }> = []
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await getPopularTVShows(page)
      allShows.push(...response.results.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })))
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch {
      // Continue
    }
  }

  stats.total = allShows.length

  const existingTmdbIds = new Set(
    (await prisma.mediaItem.findMany({
      where: { type: "TV", tmdbId: { in: allShows.map((s) => s.id) } },
      select: { tmdbId: true },
    })).map((m) => m.tmdbId)
  )
  const newShows = allShows.filter((s) => !existingTmdbIds.has(s.id))
  stats.skipped = stats.total - newShows.length

  for (const show of newShows.slice(0, 15)) {
    try {
      const details = await getTVDetails(show.id)
      const frRating = getTVFrenchRating(details.content_ratings)

      // Skip TV shows with no French relevance
      let isFR = hasTVFrenchRelevance(details, frRating)
      if (!isFR) {
        const frProviders = await getTVWatchProviders(show.id)
        isFR = frProviders !== null
      }
      if (!isFR) {
        stats.skippedNoFR++
        continue
      }

      const internalRating = mapCertificationToInternal(frRating)
      const ageRec = certificationToAge(frRating)

      const genres = details.genres?.map((g: { id: number; name: string }) => g.name) || []
      const releaseDate = details.first_air_date ? new Date(details.first_air_date) : null

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
          releaseDate,
          posterUrl,
          backdropUrl,
          synopsisFr: details.overview || null,
          officialRating: internalRating,
          expertAgeRec: ageRec,
          numberOfSeasons: details.number_of_seasons || null,
          genres,
          platforms: [],
          topics: [],
          originalLanguage: details.original_language || null,
          tmdbRating: details.vote_average || null,
          tmdbVoteCount: details.vote_count || null,
          dataSource: "TMDB",
          dataQualityScore: ageRec ? 30 : 10,
          isEnriched: false,
          lastVerifiedAt: new Date(),
        },
      })
      stats.imported++
      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch {
      stats.errors++
    }
  }

  return stats
}

// ── Poster validation & refresh ─────────────────────────────
// Checks oldest-verified posters, re-uploads broken ones from TMDB
async function validateAndRefreshPosters(limit: number = 30): Promise<{
  checked: number
  refreshed: number
  broken: number
  errors: number
}> {
  const stats = { checked: 0, refreshed: 0, broken: 0, errors: 0 }

  if (!isStorageEnabled()) return stats

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const items = await prisma.mediaItem.findMany({
    where: {
      posterUrl: { not: null },
      tmdbId: { not: null },
      type: { in: ["MOVIE", "TV"] },
      OR: [
        { lastVerifiedAt: null },
        { lastVerifiedAt: { lt: thirtyDaysAgo } },
      ],
    },
    take: limit,
    orderBy: { lastVerifiedAt: { sort: "asc", nulls: "first" } },
    select: { id: true, title: true, posterUrl: true, tmdbId: true, type: true },
  })

  for (const item of items) {
    stats.checked++
    try {
      const isValid = await isImageUrlValid(item.posterUrl!)

      if (!isValid && item.tmdbId) {
        // Re-fetch poster from TMDB and upload to Supabase
        try {
          const details = item.type === "MOVIE"
            ? await getMovieDetails(item.tmdbId)
            : await getTVDetails(item.tmdbId)

          const posterPath = details.poster_path
          if (posterPath) {
            const tmdbUrl = `https://image.tmdb.org/t/p/w500${posterPath}`
            const newUrl = await uploadPoster(item.id, tmdbUrl)
            if (newUrl) {
              await prisma.mediaItem.update({
                where: { id: item.id },
                data: { posterUrl: newUrl, lastVerifiedAt: new Date() },
              })
              stats.refreshed++
              continue
            }
          }
          stats.broken++
        } catch {
          stats.broken++
        }
      }

      // Mark as verified (even if URL was already valid)
      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { lastVerifiedAt: new Date() },
      })

      await new Promise((r) => setTimeout(r, 300))
    } catch {
      stats.errors++
    }
  }

  return stats
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Record<string, ImportStats> = {}

  try {
    // Import popular movies (2 pages = ~40 movies, import up to 20 new)
    results.popularMovies = await importMoviesFromSource("popular", 2)

    // Import now playing movies (1 page = ~20 movies)
    results.nowPlaying = await importMoviesFromSource("now_playing", 1)

    // Import family/animation movies (1 page each)
    results.familyMovies = await importMoviesFromSource("family", 1)
    results.animationMovies = await importMoviesFromSource("animation", 1)

    // Import popular TV shows (2 pages)
    results.tvShows = await importTVFromSource(2)

    // Validate and refresh broken poster URLs
    const posterRefresh = await validateAndRefreshPosters(30)

    const totalImported = Object.values(results).reduce((sum, s) => sum + s.imported, 0)
    const duration = Math.round((Date.now() - startTime) / 1000)

    console.log(`[cron] Weekly import complete: ${totalImported} new items in ${duration}s`)

    await logCronRun({
      task: "import",
      status: totalImported > 0 ? "success" : "partial",
      summary: `${totalImported} nouveaux contenus importes en ${duration}s`,
      details: results,
      startTime,
    })

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      totalImported,
      results,
      posterRefresh,
    })
  } catch (error) {
    console.error("[cron] Weekly import failed:", error)

    await logCronRun({
      task: "import",
      status: "error",
      summary: error instanceof Error ? error.message : "Import failed",
      startTime,
    })

    return NextResponse.json(
      { error: "Import failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
