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
      source = "popular", // popular, top_rated, now_playing, family, animation, kids
      pages = 5, // Number of pages to fetch (20 movies per page)
      skipExisting = true,
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

    for (let page = 1; page <= Math.min(pages, 20); page++) {
      let response

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
        default:
          response = await getPopularMovies(page)
      }

      allMovies.push(
        ...response.results.map((m) => ({ id: m.id, title: m.title }))
      )
    }

    stats.total = allMovies.length
    stats.details.push(`Fetched ${allMovies.length} movies from TMDB (${source})`)

    // Process each movie
    for (const movie of allMovies) {
      try {
        // Check if already exists
        if (skipExisting) {
          const existing = await prisma.mediaItem.findUnique({
            where: { tmdbId: movie.id },
          })
          if (existing) {
            stats.skipped++
            continue
          }
        }

        // Get full movie details
        const details = await getMovieDetails(movie.id)
        const certification = getFrenchCertification(details.release_dates)
        const director = getDirector(details.credits)

        // Upsert the movie
        await prisma.mediaItem.upsert({
          where: { tmdbId: movie.id },
          create: {
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
            platforms: [], // Will be enriched later with streaming data
            topics: [], // Will be enriched later
          },
          update: {
            title: details.title,
            originalTitle: details.original_title,
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
          },
        })

        stats.imported++

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
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
