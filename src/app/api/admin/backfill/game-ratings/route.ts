import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGameDetails } from "@/lib/igdb"

export const maxDuration = 60

/**
 * Backfill IGDB ratings (total_rating → tmdbRating, total_rating_count → tmdbVoteCount)
 * for existing games that don't have ratings yet.
 * POST /api/admin/backfill/game-ratings
 * Auth: admin routes are protected by middleware
 */
export async function POST(request: Request) {

  const body = await request.json().catch(() => ({}))
  const batchSize = Math.min(body.batch || 50, 100)

  // Find games with IGDB IDs but no rating data
  const games = await prisma.mediaItem.findMany({
    where: {
      type: "GAME",
      igdbId: { not: null },
      tmdbRating: null,
    },
    select: { id: true, igdbId: true, title: true },
    take: batchSize,
    orderBy: { dataQualityScore: "desc" },
  })

  if (games.length === 0) {
    return NextResponse.json({ success: true, message: "All games already have ratings", updated: 0 })
  }

  let updated = 0
  let errors = 0
  const details: string[] = []

  for (const game of games) {
    if (!game.igdbId) continue

    try {
      const igdbGame = await getGameDetails(game.igdbId)
      if (!igdbGame) {
        details.push(`${game.title}: not found on IGDB`)
        continue
      }

      const rating = igdbGame.total_rating ? Math.round(igdbGame.total_rating) / 10 : null
      const voteCount = igdbGame.total_rating_count || null

      if (rating || voteCount) {
        await prisma.mediaItem.update({
          where: { id: game.id },
          data: {
            tmdbRating: rating,
            tmdbVoteCount: voteCount,
          },
        })
        updated++
        details.push(`${game.title}: ${rating}/10 (${voteCount} votes)`)
      } else {
        details.push(`${game.title}: no rating on IGDB`)
      }
    } catch (error) {
      errors++
      details.push(`${game.title}: ${error instanceof Error ? error.message : "error"}`)
    }
  }

  return NextResponse.json({
    success: true,
    total: games.length,
    updated,
    errors,
    remaining: await prisma.mediaItem.count({
      where: { type: "GAME", igdbId: { not: null }, tmdbRating: null },
    }),
    details,
  })
}
