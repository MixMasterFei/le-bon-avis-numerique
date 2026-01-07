import { NextRequest, NextResponse } from "next/server"
import { getPersonMovieCredits, getPersonDetails, getImageUrl, ImageSize } from "@/lib/tmdb"

// GET /api/movies/person/[personId]/films - Get all films by a person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const personIdNum = parseInt(personId, 10)

  if (isNaN(personIdNum)) {
    return NextResponse.json(
      { error: "Invalid person ID" },
      { status: 400 }
    )
  }

  try {
    const [personDetails, credits] = await Promise.all([
      getPersonDetails(personIdNum),
      getPersonMovieCredits(personIdNum),
    ])

    // For directors, get films they directed
    // For actors, get films they acted in
    let movies: Array<{
      id: string
      tmdbId: number
      title: string
      originalTitle: string
      synopsisFr: string
      posterUrl: string
      releaseDate: string
      rating: number
      type: "MOVIE"
      role: string
    }> = []

    if (personDetails.known_for_department === "Directing") {
      // Get all films they directed
      const directedMovies = credits.crew
        .filter(movie => movie.job === "Director")
        .sort((a, b) => {
          // Sort by release date descending
          const dateA = a.release_date ? new Date(a.release_date).getTime() : 0
          const dateB = b.release_date ? new Date(b.release_date).getTime() : 0
          return dateB - dateA
        })

      movies = directedMovies.map((movie) => ({
        id: movie.id.toString(),
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        synopsisFr: movie.overview,
        posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        type: "MOVIE" as const,
        role: "Réalisateur",
      }))
    } else {
      // For actors or writers, get their filmography
      const actedMovies = credits.cast
        .sort((a, b) => {
          const dateA = a.release_date ? new Date(a.release_date).getTime() : 0
          const dateB = b.release_date ? new Date(b.release_date).getTime() : 0
          return dateB - dateA
        })
        .slice(0, 30) // Limit to 30 films for actors

      movies = actedMovies.map((movie) => ({
        id: movie.id.toString(),
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        synopsisFr: movie.overview,
        posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        type: "MOVIE" as const,
        role: movie.character || "Acteur",
      }))
    }

    return NextResponse.json({
      person: {
        id: personDetails.id,
        name: personDetails.name,
        department: personDetails.known_for_department,
        profileUrl: getImageUrl(personDetails.profile_path, ImageSize.poster.medium),
      },
      movies,
      totalCount: movies.length,
    })
  } catch (error) {
    console.error("TMDB person films error:", error)
    return NextResponse.json(
      { error: "Failed to get filmography" },
      { status: 500 }
    )
  }
}
