import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getMovieDetails,
  getTVDetails,
  getFrenchCertification,
  getTVFrenchRating,
  getDirector,
  getImageUrl,
  mapCertificationToInternal,
} from "@/lib/tmdb"
import {
  getGameDetails,
  getIGDBImageUrl,
  getPegiRating,
  normalizePlatforms,
} from "@/lib/igdb"
import { getBookDetails, transformBook } from "@/lib/google-books"

// Map certification to recommended age
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, externalId } = body

    if (!type || !externalId) {
      return NextResponse.json(
        { error: "type and externalId are required" },
        { status: 400 }
      )
    }

    const numericId = parseInt(externalId)

    // Check if already exists
    if (type === "MOVIE" || type === "TV") {
      const existing = await prisma.mediaItem.findFirst({
        where: { tmdbId: numericId, type },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "Already exists in database",
          id: existing.id,
          alreadyExists: true,
        })
      }
    } else if (type === "GAME") {
      const existing = await prisma.mediaItem.findFirst({
        where: { igdbId: numericId, type: "GAME" },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "Already exists in database",
          id: existing.id,
          alreadyExists: true,
        })
      }
    }

    let newItem

    if (type === "MOVIE") {
      const details = await getMovieDetails(numericId)
      const certification = getFrenchCertification(details.release_dates)
      const director = getDirector(details.credits)

      newItem = await prisma.mediaItem.create({
        data: {
          tmdbId: numericId,
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
          officialRating: mapCertificationToInternal(certification),
          expertAgeRec: certificationToAge(certification),
          originalLanguage: details.original_language || null,
          platforms: [],
          topics: [],
        },
      })
    } else if (type === "TV") {
      const details = await getTVDetails(numericId)
      const rating = getTVFrenchRating(details.content_ratings)

      newItem = await prisma.mediaItem.create({
        data: {
          tmdbId: numericId,
          title: details.name,
          originalTitle: details.original_name,
          type: "TV",
          synopsisFr: details.overview || null,
          posterUrl: getImageUrl(details.poster_path, "w500"),
          backdropUrl: details.backdrop_path
            ? getImageUrl(details.backdrop_path, "w1280")
            : null,
          releaseDate: details.first_air_date
            ? new Date(details.first_air_date)
            : null,
          duration: details.episode_run_time?.[0] || null,
          genres: details.genres.map((g) => g.name),
          officialRating: mapCertificationToInternal(rating),
          expertAgeRec: certificationToAge(rating),
          originalLanguage: details.original_language || null,
          platforms: details.networks?.map((n) => n.name) || [],
          topics: [],
        },
      })
    } else if (type === "GAME") {
      const game = await getGameDetails(numericId)
      if (!game) {
        return NextResponse.json(
          { error: "Game not found in IGDB" },
          { status: 404 }
        )
      }

      const pegi = getPegiRating(game.age_ratings)
      const developer = game.involved_companies?.find((c) => c.developer)

      newItem = await prisma.mediaItem.create({
        data: {
          igdbId: game.id,
          title: game.name,
          type: "GAME",
          synopsisFr: game.summary || game.storyline || null,
          posterUrl: getIGDBImageUrl(game.cover?.image_id, "medium"),
          releaseDate: game.first_release_date
            ? new Date(game.first_release_date * 1000)
            : null,
          genres: game.genres?.map((g) => g.name) || [],
          platforms: normalizePlatforms(game.platforms),
          officialRating: pegi?.internal || null,
          expertAgeRec: pegi?.age || null,
          director: developer?.company.name || null,
          topics: game.themes?.map((t) => t.name) || [],
        },
      })
    } else if (type === "BOOK") {
      const volume = await getBookDetails(externalId)
      const b = transformBook(volume)

      newItem = await prisma.mediaItem.create({
        data: {
          title: b.title,
          originalTitle: b.originalTitle,
          type: "BOOK",
          synopsisFr: b.synopsisFr,
          posterUrl: b.posterUrl,
          releaseDate: b.releaseDate ? new Date(b.releaseDate) : null,
          genres: b.genres,
          director: b.author,
          officialRating: b.officialRating,
          expertAgeRec: b.expertAgeRec,
          platforms: [],
          topics: [],
        },
      })
    } else {
      return NextResponse.json(
        { error: "Unsupported media type" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${type} imported successfully`,
      id: newItem.id,
      title: newItem.title,
    })
  } catch (error) {
    console.error("Single import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}
