import { NextRequest, NextResponse } from "next/server"
import { getPopularGames, transformGame } from "@/lib/igdb"

export async function GET(request: NextRequest) {
  try {
    const results = await getPopularGames()
    const games = results.map(transformGame)

    return NextResponse.json({
      games,
      totalResults: games.length,
    })
  } catch (error) {
    console.error("IGDB popular games error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch games" },
      { status: 500 }
    )
  }
}




