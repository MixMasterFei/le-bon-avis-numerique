import { NextRequest, NextResponse } from "next/server"
import { searchGames, transformGame } from "@/lib/igdb"
import { sanitizeSearchQuery } from "@/lib/security"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get("q")

  if (!rawQuery) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  const query = sanitizeSearchQuery(rawQuery)

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
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



