import { NextRequest, NextResponse } from "next/server"
import { getGamesByCompany, transformGame } from "@/lib/igdb"

// GET /api/games/company/[companyId]/games - Get all games by a company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const companyIdNum = parseInt(companyId, 10)

  if (isNaN(companyIdNum)) {
    return NextResponse.json(
      { error: "Invalid company ID" },
      { status: 400 }
    )
  }

  try {
    const games = await getGamesByCompany(companyIdNum)

    const transformedGames = games.map((game) => {
      const transformed = transformGame(game)
      return {
        id: transformed.id,
        title: transformed.title,
        synopsisFr: transformed.synopsisFr,
        posterUrl: transformed.posterUrl,
        releaseDate: transformed.releaseDate,
        rating: transformed.rating ? transformed.rating * 2 : null, // Convert back to 0-10 scale
        type: "GAME" as const,
        officialRating: transformed.officialRating,
        developer: transformed.developer,
        platforms: transformed.platforms,
      }
    })

    return NextResponse.json({
      games: transformedGames,
      totalCount: transformedGames.length,
    })
  } catch (error) {
    console.error("IGDB company games error:", error)
    return NextResponse.json(
      { error: "Failed to get company games" },
      { status: 500 }
    )
  }
}
