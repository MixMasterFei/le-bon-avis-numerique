import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  discoverMovies,
  getMovieDetails,
  getFrenchCertification,
  getDirector,
  getImageUrl,
  MovieGenres,
} from "@/lib/tmdb"

// Map French CSA certification to recommended age
function certificationToAge(cert: string | null): number | null {
  if (!cert) return null
  const map: Record<string, number> = {
    U: 0,
    TP: 0,
    "10": 10,
    "12": 12,
    "16": 16,
    "18": 18,
  }
  return map[cert] ?? null
}

interface ImportStats {
  total: number
  imported: number
  skipped: number
  errors: number
  details: string[]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      source = "popular", // popular, top_rated, now_playing, family, animation, kids, by_year, by_genre, french
      pages = 5, // Number of pages to fetch (20 movies per page)
      skipExisting = true,
      year = null, // For by_year source
      genre = null, // For by_genre source
      startPage = 1, // Allow starting from a specific page for pagination
    } = body

    const stats: ImportStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // Collect all movies from multiple pages
    const allMovies: Array<{ id: number; title: string }> = []
    const maxPages = Math.min(pages, 50) // Allow up to 50 pages (1000 movies per import)

    for (let page = startPage; page < startPage + maxPages; page++) {
      let response

      try {
        switch (source) {
          case "top_rated":
            response = await getTopRatedMovies(page)
            break
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
          case "kids":
            // Animation + Family combined
            response = await discoverMovies({
              page,
              with_genres: `${MovieGenres.ANIMATION},${MovieGenres.FAMILY}`,
              certification_country: "FR",
              "certification.lte": "12",
              sort_by: "popularity.desc",
            })
            break
          case "by_year":
            // Import movies from a specific year
            response = await discoverMovies({
              page,
              primary_release_year: year || new Date().getFullYear(),
              sort_by: "popularity.desc",
            })
            break
          case "by_genre":
            // Import movies from a specific genre
            response = await discoverMovies({
              page,
              with_genres: genre || MovieGenres.ACTION.toString(),
              sort_by: "popularity.desc",
            })
            break
          case "french":
            // French movies
            response = await discoverMovies({
              page,
              with_original_language: "fr",
              sort_by: "popularity.desc",
            })
            break
          case "classics":
            // Classic movies (before 2000)
            response = await discoverMovies({
              page,
              "primary_release_date.lte": "1999-12-31",
              sort_by: "vote_count.desc",
            })
            break
          case "recent":
            // Movies from last 2 years
            const twoYearsAgo = new Date()
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
            response = await discoverMovies({
              page,
              "primary_release_date.gte": twoYearsAgo.toISOString().split("T")[0],
              sort_by: "popularity.desc",
            })
            break
          case "highly_rated":
            // Highly rated movies (7+ score)
            response = await discoverMovies({
              page,
              "vote_average.gte": "7",
              "vote_count.gte": "1000",
              sort_by: "vote_average.desc",
            })
            break
          default:
            response = await getPopularMovies(page)
        }

        allMovies.push(
          ...response.results.map((m) => ({ id: m.id, title: m.title }))
        )

        // Small delay between page fetches
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (pageError) {
        stats.details.push(`Error fetching page ${page}: ${pageError instanceof Error ? pageError.message : "Unknown"}`)
        // Continue to next page even if one fails
      }
    }

    stats.details.push(`Fetched ${allMovies.length} movies from TMDB (${source})`)

    // Pre-filter: Get all existing tmdbIds in one query to avoid N+1
    const existingTmdbIds = new Set(
      (await prisma.mediaItem.findMany({
        where: {
          tmdbId: { in: allMovies.map(m => m.id) }
        },
        select: { tmdbId: true }
      })).map(m => m.tmdbId)
    )

    // Filter out existing movies BEFORE processing
    const newMovies = skipExisting
      ? allMovies.filter(m => !existingTmdbIds.has(m.id))
      : allMovies

    stats.total = allMovies.length
    stats.skipped = existingTmdbIds.size
    stats.details.push(`${newMovies.length} nouveaux films à importer (${existingTmdbIds.size} déjà en base)`)

    // Process only NEW movies
    for (const movie of newMovies) {
      try {
        // Get full movie details
        const details = await getMovieDetails(movie.id)
        const certification = getFrenchCertification(details.release_dates)
        const director = getDirector(details.credits)

        // Create the movie (we already filtered out existing ones)
        await prisma.mediaItem.create({
          data: {
            tmdbId: movie.id,
            title: details.title,
            originalTitle: details.original_title,
            type: "MOVIE",
            synopsisFr: details.overview || null,
            posterUrl: getImageUrl(details.poster_path, "w500"),
            backdropUrl: details.backdrop_path
              ? getImageUrl(details.backdrop_path, "w1280")
              : null,
            releaseDate: details.release_date
              ? new Date(details.release_date)
              : null,
            duration: details.runtime || null,
            director: director,
            genres: details.genres.map((g) => g.name),
            officialRating: certification,
            expertAgeRec: certificationToAge(certification),
            platforms: [],
            topics: [],
          },
        })

        stats.imported++

        // Delay to avoid TMDB rate limiting (40 requests per 10 seconds = ~250ms between requests)
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (error) {
        stats.errors++
        stats.details.push(
          `Error importing ${movie.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    stats.details.push(
      `Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`
    )

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("Movie import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}

// GET to check current database stats
export async function GET() {
  const movieCount = await prisma.mediaItem.count({
    where: { type: "MOVIE" },
  })

  const recentMovies = await prisma.mediaItem.findMany({
    where: { type: "MOVIE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { title: true, tmdbId: true, createdAt: true },
  })

  return NextResponse.json({
    movieCount,
    recentMovies,
  })
}
