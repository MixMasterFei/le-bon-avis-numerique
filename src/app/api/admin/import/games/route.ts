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
  IGDBGame,
} from "@/lib/igdb"
import { createGameFromIgdb } from "@/lib/game-import"

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
        // Family-guide adult guard lives in createGameFromIgdb; null = skipped.
        const created = await createGameFromIgdb(game)
        if (!created) {
          stats.details.push(`Skipped adult game: ${game.name}`)
          continue
        }
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
