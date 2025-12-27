import { NextRequest, NextResponse } from "next/server"
import { getPopularMovies, getImageUrl, ImageSize } from "@/lib/tmdb"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const results = await getPopularMovies(page)
    
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
    console.error("TMDB popular movies error:", error)
    return NextResponse.json(
      { error: "Failed to fetch popular movies" },
      { status: 500 }
    )
  }
}





