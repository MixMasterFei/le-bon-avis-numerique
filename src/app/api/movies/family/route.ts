import { NextRequest, NextResponse } from "next/server"
import { discoverMovies, getImageUrl, ImageSize, MovieGenres } from "@/lib/tmdb"

/**
 * Get family-friendly movies
 * Filters by Animation and Family genres with good ratings
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const results = await discoverMovies({
      page,
      with_genres: `${MovieGenres.FAMILY},${MovieGenres.ANIMATION}`,
      sort_by: "popularity.desc",
      "vote_average.gte": "6",
      certification_country: "FR",
      "certification.lte": "12", // Only movies rated 12 and under
    })
    
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
    console.error("TMDB family movies error:", error)
    return NextResponse.json(
      { error: "Failed to fetch family movies" },
      { status: 500 }
    )
  }
}



