import { NextRequest, NextResponse } from "next/server"
import { getGameDetails, transformGame } from "@/lib/igdb"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const gameId = parseInt(id)

  if (isNaN(gameId)) {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 })
  }

  try {
    const game = await getGameDetails(gameId)

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    return NextResponse.json(transformGame(game))
  } catch (error) {
    console.error("IGDB game details error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch game" },
      { status: 500 }
    )
  }
}




