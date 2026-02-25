import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Upgrade all IGDB game cover URLs from t_cover_big (264x374) to t_720p (720p).
 * Pure string replacement — no external API calls needed.
 */
export async function POST() {
  try {
    const games = await prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        posterUrl: { contains: "t_cover_big" },
      },
      select: { id: true, title: true, posterUrl: true },
    })

    let fixed = 0
    for (const game of games) {
      if (!game.posterUrl) continue
      const newUrl = game.posterUrl.replace("t_cover_big", "t_720p")
      await prisma.mediaItem.update({
        where: { id: game.id },
        data: { posterUrl: newUrl },
      })
      fixed++
    }

    return NextResponse.json({
      success: true,
      done: true,
      processed: games.length,
      updated: fixed,
      skipped: games.length - fixed,
      errors: 0,
    })
  } catch (error) {
    console.error("Fix game covers error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fix failed" },
      { status: 500 },
    )
  }
}

export async function GET() {
  const needsFixing = await prisma.mediaItem.count({
    where: {
      type: "GAME",
      posterUrl: { contains: "t_cover_big" },
    },
  })

  const alreadyFixed = await prisma.mediaItem.count({
    where: {
      type: "GAME",
      posterUrl: { contains: "t_720p" },
    },
  })

  return NextResponse.json({
    needsFixing,
    alreadyFixed,
    message: needsFixing > 0
      ? `${needsFixing} jeux avec des covers basse résolution.`
      : "Toutes les covers sont en haute résolution.",
  })
}
