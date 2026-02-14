import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getPopularMovies,
  getNowPlayingMovies,
  discoverMovies,
  getMovieDetails,
  getFrenchCertification,
  getDirector,
  getImageUrl,
  MovieGenres,
  mapCertificationToInternal,
  getPopularTVShows,
  getTVDetails,
  getTVFrenchRating,
} from "@/lib/tmdb"

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
  // Also allow in development
  if (process.env.NODE_ENV === "development") return true
  return false
}

interface ImportStats {
  total: number
  imported: number
  skipped: number
  errors: number
}

async function importMoviesFromSource(
  source: "popular" | "now_playing" | "family" | "animation",
  pages: number
): Promise<ImportStats> {
  const stats: ImportStats = { total: 0, imported: 0, skipped: 0, errors: 0 }

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
      allMovies.push(...response.results.map((m: any) => ({ id: m.id, title: m.title })))
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
      const director = getDirector(details.credits)
      const internalRating = mapCertificationToInternal(frCert)
      const ageRec = certificationToAge(frCert)

      const genres = details.genres?.map((g: any) => g.name) || []
      const releaseDate = details.release_date ? new Date(details.release_date) : null

      await prisma.mediaItem.create({
        data: {
          tmdbId: details.id,
          title: details.title,
          originalTitle: details.original_title !== details.title ? details.original_title : null,
          type: "MOVIE",
          releaseDate,
          posterUrl: details.poster_path ? getImageUrl(details.poster_path, "w500") : null,
          backdropUrl: details.backdrop_path ? getImageUrl(details.backdrop_path, "w1280") : null,
          synopsisFr: details.overview || null,
          officialRating: internalRating,
          expertAgeRec: ageRec,
          duration: details.runtime || null,
          director: director || null,
          genres,
          platforms: [],
          topics: [],
          originalLanguage: details.original_language || null,
          dataSource: "TMDB",
          dataQualityScore: ageRec ? 30 : 10,
          isEnriched: false,
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
  const stats: ImportStats = { total: 0, imported: 0, skipped: 0, errors: 0 }

  const allShows: Array<{ id: number; name: string }> = []
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await getPopularTVShows(page)
      allShows.push(...response.results.map((s: any) => ({ id: s.id, name: s.name })))
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
      const internalRating = mapCertificationToInternal(frRating)
      const ageRec = certificationToAge(frRating)

      const genres = details.genres?.map((g: any) => g.name) || []
      const releaseDate = details.first_air_date ? new Date(details.first_air_date) : null

      await prisma.mediaItem.create({
        data: {
          tmdbId: details.id,
          title: details.name,
          originalTitle: details.original_name !== details.name ? details.original_name : null,
          type: "TV",
          releaseDate,
          posterUrl: details.poster_path ? getImageUrl(details.poster_path, "w500") : null,
          backdropUrl: details.backdrop_path ? getImageUrl(details.backdrop_path, "w1280") : null,
          synopsisFr: details.overview || null,
          officialRating: internalRating,
          expertAgeRec: ageRec,
          numberOfSeasons: details.number_of_seasons || null,
          genres,
          platforms: [],
          topics: [],
          originalLanguage: details.original_language || null,
          dataSource: "TMDB",
          dataQualityScore: ageRec ? 30 : 10,
          isEnriched: false,
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

    const totalImported = Object.values(results).reduce((sum, s) => sum + s.imported, 0)
    const duration = Math.round((Date.now() - startTime) / 1000)

    console.log(`[cron] Weekly import complete: ${totalImported} new items in ${duration}s`)

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      totalImported,
      results,
    })
  } catch (error) {
    console.error("[cron] Weekly import failed:", error)
    return NextResponse.json(
      { error: "Import failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
