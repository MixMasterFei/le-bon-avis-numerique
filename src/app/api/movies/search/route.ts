import { NextRequest, NextResponse } from "next/server"
import { searchMovies, getImageUrl, ImageSize } from "@/lib/tmdb"
import { sanitizeSearchQuery, sanitizeNumber } from "@/lib/security"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get("q")
  const rawPage = searchParams.get("page")

  // Validate and sanitize inputs
  if (!rawQuery) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  const query = sanitizeSearchQuery(rawQuery)
  const page = sanitizeNumber(rawPage, 1, 500) || 1

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    )
  }

  try {
    const results = await searchMovies(query, page)

    // Transform to our format
    const movies = results.results.map((movie) => ({
      id: movie.id.toString(),
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      synopsisFr: movie.overview,
      posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
      releaseDate: movie.release_date,
      rating: movie.vote_average,
      type: "MOVIE" as const,
    }))

    return NextResponse.json({
      movies,
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
    })
  } catch (error) {
    console.error("TMDB search error:", error)
    return NextResponse.json(
      { error: "Failed to search movies" },
      { status: 500 }
    )
  }
}


