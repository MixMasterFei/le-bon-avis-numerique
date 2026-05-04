import { NextResponse } from "next/server"
import { getNowPlayingMovies, getImageUrl, ImageSize } from "@/lib/tmdb"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"

/**
 * GET /api/cinema
 *
 * Returns movies currently playing in French theaters.
 * Uses TMDB's now_playing endpoint (region=FR) as the source of truth,
 * then enriches with our DB data (expert age recommendations, etc.).
 * Falls back to TMDB-only data for movies not yet in our DB.
 */
export async function GET() {
  try {
    // Fetch the first page of now_playing from TMDB (region=FR)
    const tmdbResult = await getNowPlayingMovies(1)
    const tmdbMovies = tmdbResult.results || []

    // Filter to European languages only (exclude Japanese anime, Korean, Chinese, etc.)
    const europeanLanguages = new Set(["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"])
    const filteredMovies = tmdbMovies.filter((m) => europeanLanguages.has(m.original_language))

    if (filteredMovies.length === 0) {
      return NextResponse.json({ movies: [] })
    }

    // Extract TMDB IDs to look up in our database
    const tmdbIds = filteredMovies.map((m) => m.id)

    // Find matching movies in our DB (for age recommendations, enrichment, etc.)
    let dbMovies: Array<{
      tmdbId: number | null
      id: string
      title: string
      posterUrl: string | null
      expertAgeRec: number | null
      communityAgeRec: number | null
      genres: string[]
      topics: string[]
      contentMetrics: {
        toneTags: string[]
        pacing: string | null
        violence: number | null
        sexNudity: number | null
        language: number | null
        substanceUse: number | null
      } | null
    }> = []

    try {
      dbMovies = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: {
            tmdbId: { in: tmdbIds },
            type: "MOVIE",
          },
          select: {
            tmdbId: true,
            id: true,
            title: true,
            posterUrl: true,
            expertAgeRec: true,
            communityAgeRec: true,
            genres: true,
            topics: true,
            contentMetrics: {
              select: {
                toneTags: true,
                pacing: true,
                // Required for Aperçu's 15+ blur (see shouldBlurMedia).
                violence: true,
                sexNudity: true,
                language: true,
                substanceUse: true,
              },
            },
          },
        })
      )
    } catch {
      // DB lookup failed — we'll use TMDB-only data below
    }

    const dbByTmdbId = new Map(
      dbMovies.filter((m) => m.tmdbId !== null).map((m) => [m.tmdbId!, m])
    )

    // Merge TMDB order (popularity) with our DB enrichment
    const movies = filteredMovies.map((tmdb) => {
      const db = dbByTmdbId.get(tmdb.id)
      return {
        id: db?.id ?? `tmdb-${tmdb.id}`,
        tmdbId: tmdb.id,
        title: tmdb.title,
        originalTitle: tmdb.original_title,
        posterUrl:
          db?.posterUrl ||
          getImageUrl(tmdb.poster_path, ImageSize.poster.medium),
        releaseDate: tmdb.release_date,
        expertAgeRec: db?.expertAgeRec ?? null,
        communityAgeRec: db?.communityAgeRec ?? null,
        genres: db?.genres ?? [],
        topics: db?.topics ?? [],
        toneTags: db?.contentMetrics?.toneTags ?? [],
        contentMetrics: db?.contentMetrics
          ? {
              violence: db.contentMetrics.violence,
              sexNudity: db.contentMetrics.sexNudity,
              language: db.contentMetrics.language,
              substanceUse: db.contentMetrics.substanceUse,
            }
          : null,
        inDatabase: !!db,
      }
    })

    return NextResponse.json(
      { movies },
      {
        headers: {
          // 30 min CDN cache (was 1h) — TMDB updates now_playing
          // throughout the day as theatrical releases shift, and
          // users perceive the homepage section as stale at the 1h
          // mark. SWR window stays at 1h for graceful degradation.
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    )
  } catch (error) {
    console.error("Cinema API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch now playing movies" },
      { status: 500 }
    )
  }
}
