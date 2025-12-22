import { NextRequest, NextResponse } from "next/server"
import { searchGames, transformGame } from "@/lib/igdb"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  try {
    const results = await searchGames(query)
    const games = results.map(transformGame)

    return NextResponse.json({
      games,
      totalResults: games.length,
    })
  } catch (error) {
    console.error("IGDB search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search games" },
      { status: 500 }
    )
  }
}

