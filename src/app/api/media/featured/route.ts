import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "8")
    const mixed = searchParams.get("mixed") === "true"

    // Get a mix of movies and TV shows with good ratings
    const items = await prisma.mediaItem.findMany({
      where: {
        posterUrl: { not: null },
        expertAgeRec: { not: null },
      },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        expertAgeRec: true,
        genres: true,
      },
      orderBy: [
        { releaseDate: "desc" },
      ],
      take: mixed ? limit * 2 : limit, // Get more to allow mixing
    })

    // If mixed, try to alternate between movies and TV
    let finalItems = items
    if (mixed && items.length > 0) {
      const movies = items.filter((i: typeof items[0]) => i.type === "MOVIE")
      const tvShows = items.filter((i: typeof items[0]) => i.type === "TV")

      // Interleave movies and TV shows
      const interleaved: typeof items = []
      const maxLen = Math.max(movies.length, tvShows.length)

      for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
        if (i < movies.length && interleaved.length < limit) {
          interleaved.push(movies[i])
        }
        if (i < tvShows.length && interleaved.length < limit) {
          interleaved.push(tvShows[i])
        }
      }

      finalItems = interleaved.length > 0 ? interleaved : items.slice(0, limit)
    } else {
      finalItems = items.slice(0, limit)
    }

    return NextResponse.json({ items: finalItems })
  } catch (error) {
    console.error("Failed to fetch featured media:", error)
    return NextResponse.json(
      { error: "Failed to fetch featured media" },
      { status: 500 }
    )
  }
}
