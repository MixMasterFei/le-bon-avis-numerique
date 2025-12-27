import { NextRequest, NextResponse } from "next/server"
import { searchTVShows, getImageUrl, ImageSize } from "@/lib/tmdb"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const page = parseInt(searchParams.get("page") || "1")

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  try {
    const results = await searchTVShows(query, page)
    
    const shows = results.results.map((show) => ({
      id: show.id.toString(),
      tmdbId: show.id,
      title: show.name,
      originalTitle: show.original_name,
      synopsisFr: show.overview,
      posterUrl: getImageUrl(show.poster_path, ImageSize.poster.medium),
      releaseDate: show.first_air_date,
      rating: show.vote_average,
      type: "TV" as const,
    }))

    return NextResponse.json({
      shows,
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
    })
  } catch (error) {
    console.error("TMDB TV search error:", error)
    return NextResponse.json(
      { error: "Failed to search TV shows" },
      { status: 500 }
    )
  }
}




