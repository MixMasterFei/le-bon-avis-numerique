import { NextRequest, NextResponse } from "next/server"
import {
  getMovieDetails,
  getImageUrl,
  ImageSize,
  getFrenchCertification,
  getDirector,
  mapCertificationToInternal,
} from "@/lib/tmdb"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const movieId = parseInt(id)

  if (isNaN(movieId)) {
    return NextResponse.json(
      { error: "Invalid movie ID" },
      { status: 400 }
    )
  }

  try {
    const movie = await getMovieDetails(movieId)
    
    const certification = getFrenchCertification(movie.release_dates)
    const director = getDirector(movie.credits)
    
    // Transform to our format
    const transformedMovie = {
      id: movie.id.toString(),
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      type: "MOVIE" as const,
      releaseDate: movie.release_date,
      posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.large),
      backdropUrl: getImageUrl(movie.backdrop_path, ImageSize.backdrop.large),
      synopsisFr: movie.overview,
      officialRating: mapCertificationToInternal(certification),
      duration: movie.runtime,
      director,
      genres: movie.genres.map((g) => g.name),
      cast: movie.credits?.cast.slice(0, 10).map((c) => ({
        name: c.name,
        character: c.character,
        photo: getImageUrl(c.profile_path, "w185"),
      })),
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
    }

    return NextResponse.json(transformedMovie)
  } catch (error) {
    console.error("TMDB movie details error:", error)
    return NextResponse.json(
      { error: "Failed to fetch movie details" },
      { status: 500 }
    )
  }
}





