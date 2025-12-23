import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getPopularGames,
  getFamilyGames,
  getRecentGames,
  getIGDBImageUrl,
  getPegiRating,
  normalizePlatforms,
  IGDBGame,
} from "@/lib/igdb"

interface ImportStats {
  total: number
  imported: number
  skipped: number
  errors: number
  details: string[]
}

function transformGameToMediaItem(game: IGDBGame) {
  const pegi = getPegiRating(game.age_ratings)
  const developer = game.involved_companies?.find((c) => c.developer)

  return {
    igdbId: game.id,
    title: game.name,
    type: "GAME" as const,
    synopsisFr: game.summary || game.storyline || null,
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "medium"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    genres: game.genres?.map((g) => g.name) || [],
    platforms: normalizePlatforms(game.platforms), // Only modern platforms
    officialRating: pegi?.internal || null,
    expertAgeRec: pegi?.age || null,
    director: developer?.company.name || null, // Using director field for developer
    topics: game.themes?.map((t) => t.name) || [],
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      source = "popular", // popular, family, recent
      limit = 100,
      skipExisting = true,
    } = body

    const stats: ImportStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // Fetch games based on source
    let games: IGDBGame[]

    switch (source) {
      case "family":
        games = await getFamilyGames(limit)
        break
      case "recent":
        games = await getRecentGames(limit)
        break
      default:
        games = await getPopularGames(limit)
    }

    stats.total = games.length
    stats.details.push(`Fetched ${games.length} games from IGDB (${source})`)

    // Process each game
    for (const game of games) {
      try {
        // Check if already exists
        if (skipExisting) {
          const existing = await prisma.mediaItem.findUnique({
            where: { igdbId: game.id },
          })
          if (existing) {
            stats.skipped++
            continue
          }
        }

        const data = transformGameToMediaItem(game)

        // Upsert the game
        await prisma.mediaItem.upsert({
          where: { igdbId: game.id },
          create: {
            ...data,
            originalTitle: null,
            backdropUrl: null,
            duration: null,
            communityAgeRec: null,
          },
          update: {
            title: data.title,
            synopsisFr: data.synopsisFr,
            posterUrl: data.posterUrl,
            releaseDate: data.releaseDate,
            genres: data.genres,
            platforms: data.platforms,
            officialRating: data.officialRating,
            expertAgeRec: data.expertAgeRec,
            director: data.director,
            topics: data.topics,
          },
        })

        stats.imported++
      } catch (error) {
        stats.errors++
        stats.details.push(
          `Error importing ${game.name}: ${error instanceof Error ? error.message : "Unknown error"}`
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
    console.error("Game import error:", error)
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
  const gameCount = await prisma.mediaItem.count({
    where: { type: "GAME" },
  })

  const recentGames = await prisma.mediaItem.findMany({
    where: { type: "GAME" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { title: true, igdbId: true, createdAt: true },
  })

  return NextResponse.json({
    gameCount,
    recentGames,
  })
}
