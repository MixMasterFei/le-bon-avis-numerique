import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Vercel serverless function config
export const maxDuration = 60

import {
  getPopularGames,
  getFamilyGames,
  getRecentGames,
  getSwitchGames,
  getPS5Games,
  getPS4Games,
  getXboxSeriesGames,
  getPCGames,
  getGamesByFranchise,
  getTopRatedGames,
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
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "large"),
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
      source = "popular", // popular, family, recent, switch, ps5, ps4, xbox, pc, top_rated, franchise
      limit = 100,
      skipExisting = true,
      franchise = "", // For franchise search (e.g., "Zelda", "Mario", "Pokemon")
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
      case "switch":
        games = await getSwitchGames(limit)
        break
      case "ps5":
        games = await getPS5Games(limit)
        break
      case "ps4":
        games = await getPS4Games(limit)
        break
      case "xbox":
        games = await getXboxSeriesGames(limit)
        break
      case "pc":
        games = await getPCGames(limit)
        break
      case "top_rated":
        games = await getTopRatedGames(limit)
        break
      case "franchise":
        if (!franchise) {
          return NextResponse.json(
            { success: false, error: "Franchise name required for franchise import" },
            { status: 400 }
          )
        }
        games = await getGamesByFranchise(franchise, limit)
        break
      default:
        games = await getPopularGames(limit)
    }

    stats.details.push(`Fetched ${games.length} games from IGDB (${source})`)

    // Pre-filter existing games
    const existingIgdbIds = new Set(
      (await prisma.mediaItem.findMany({
        where: {
          igdbId: { in: games.map(g => g.id) }
        },
        select: { igdbId: true }
      })).map(m => m.igdbId)
    )

    const newGames = skipExisting
      ? games.filter(g => !existingIgdbIds.has(g.id))
      : games

    stats.total = games.length
    stats.skipped = existingIgdbIds.size
    stats.details.push(`${newGames.length} nouveaux jeux à importer (${existingIgdbIds.size} déjà en base)`)

    // Process only NEW games
    for (const game of newGames) {
      try {
        const data = transformGameToMediaItem(game)

        await prisma.mediaItem.create({
          data: {
            ...data,
            originalTitle: null,
            backdropUrl: null,
            duration: null,
            communityAgeRec: null,
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
