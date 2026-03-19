/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getPopularMovies,
  getPopularTVShows,
  getMovieDetails,
  getTVDetails,
  getImageUrl,
  ImageSize,
  getFrenchCertification,
  getDirector,
  getTVFrenchRating,
  mapCertificationToInternal,
} from "@/lib/tmdb"

export const maxDuration = 60

// Check if user is admin
async function checkAdmin() {
  const session = await auth()
  return {
    isAdmin: session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR",
    userId: session?.user?.id,
  }
}

interface PresetConfig {
  fetchFn: (page?: number) => Promise<{ results: any[] }>
  type: "MOVIE" | "TV"
  filter?: (item: any) => boolean
}

const PRESETS: Record<string, PresetConfig> = {
  trending_week: {
    fetchFn: getPopularMovies,
    type: "MOVIE",
  },
  popular: {
    fetchFn: getPopularTVShows,
    type: "TV",
  },
  family_animation: {
    fetchFn: getPopularMovies,
    type: "MOVIE",
    filter: (movie) => {
      // Filter for animation and family genres
      const genreIds = movie.genre_ids || []
      const isAnimation = genreIds.includes(16) // Animation
      const isFamily = genreIds.includes(10751) // Family
      return isAnimation || isFamily
    },
  },
  recent: {
    fetchFn: getPopularMovies,
    type: "MOVIE",
  },
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, userId } = await checkAdmin()
    if (!userId || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { preset, limit = 20 } = body

    if (!preset || !PRESETS[preset]) {
      return NextResponse.json(
        { error: "Invalid preset" },
        { status: 400 }
      )
    }

    const config = PRESETS[preset]
    let imported = 0
    let skipped = 0
    let errors = 0
    const details: string[] = []

    // Fetch list from TMDB
    const response = await config.fetchFn(1)
    let results = response.results || []

    // Apply filter if defined
    if (config.filter) {
      results = results.filter(config.filter)
    }

    // Limit results
    results = results.slice(0, limit)

    for (const item of results) {
      try {
        const tmdbId = item.id

        // Check if already exists
        const existing = await prisma.mediaItem.findFirst({
          where: {
            tmdbId,
            type: config.type,
          },
        })

        if (existing) {
          skipped++
          continue
        }

        // Fetch full details
        let mediaData: any

        if (config.type === "MOVIE") {
          const movie = await getMovieDetails(tmdbId)
          const certification = getFrenchCertification(movie.release_dates)
          const director = getDirector(movie.credits)

          mediaData = {
            tmdbId: movie.id,
            type: "MOVIE",
            title: movie.title,
            originalTitle: movie.original_title,
            synopsisFr: movie.overview || null,
            posterUrl: movie.poster_path
              ? getImageUrl(movie.poster_path, ImageSize.poster.large)
              : null,
            backdropUrl: movie.backdrop_path
              ? getImageUrl(movie.backdrop_path, ImageSize.backdrop.large)
              : null,
            releaseDate: movie.release_date ? new Date(movie.release_date) : null,
            duration: movie.runtime || null,
            director: director || null,
            genres: movie.genres?.map((g: any) => g.name) || [],
            officialRating: mapCertificationToInternal(certification),
            originalLanguage: movie.original_language || null,
            dataQualityScore: 30, // Base score for auto-imported
          }
        } else {
          const show = await getTVDetails(tmdbId)
          const rating = getTVFrenchRating(show.content_ratings)

          mediaData = {
            tmdbId: show.id,
            type: "TV",
            title: show.name,
            originalTitle: show.original_name,
            synopsisFr: show.overview || null,
            posterUrl: show.poster_path
              ? getImageUrl(show.poster_path, ImageSize.poster.large)
              : null,
            backdropUrl: show.backdrop_path
              ? getImageUrl(show.backdrop_path, ImageSize.backdrop.large)
              : null,
            releaseDate: show.first_air_date ? new Date(show.first_air_date) : null,
            duration: show.episode_run_time?.[0] || null,
            numberOfSeasons: show.number_of_seasons || null,
            genres: show.genres?.map((g: any) => g.name) || [],
            platforms: show.networks?.map((n: any) => n.name) || [],
            officialRating: mapCertificationToInternal(rating),
            originalLanguage: show.original_language || null,
            dataQualityScore: 30,
          }
        }

        await prisma.mediaItem.create({ data: mediaData })
        imported++
        details.push(mediaData.title)

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (err) {
        errors++
        console.error("Import error:", err)
      }
    }

    // Log admin activity
    await prisma.adminActivity.create({
      data: {
        userId,
        action: "BATCH_IMPORT",
        entityType: config.type,
        details: JSON.stringify({
          preset,
          imported,
          skipped,
          errors,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      details: details.slice(0, 10), // First 10 titles
    })
  } catch (error) {
    console.error("Batch import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Batch import failed",
      },
      { status: 500 }
    )
  }
}
