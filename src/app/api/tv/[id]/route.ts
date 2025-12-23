import { NextRequest, NextResponse } from "next/server"
import {
  getTVDetails,
  getImageUrl,
  ImageSize,
  getTVFrenchRating,
  mapCertificationToInternal,
} from "@/lib/tmdb"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tvId = parseInt(id)

  if (isNaN(tvId)) {
    return NextResponse.json(
      { error: "Invalid TV show ID" },
      { status: 400 }
    )
  }

  try {
    const show = await getTVDetails(tvId)
    
    const rating = getTVFrenchRating(show.content_ratings)
    
    const transformedShow = {
      id: show.id.toString(),
      tmdbId: show.id,
      title: show.name,
      originalTitle: show.original_name,
      type: "TV" as const,
      releaseDate: show.first_air_date,
      posterUrl: getImageUrl(show.poster_path, ImageSize.poster.large),
      backdropUrl: getImageUrl(show.backdrop_path, ImageSize.backdrop.large),
      synopsisFr: show.overview,
      officialRating: mapCertificationToInternal(rating),
      duration: show.episode_run_time[0] || null,
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      genres: show.genres.map((g) => g.name),
      networks: show.networks.map((n) => n.name),
      createdBy: show.created_by.map((c) => c.name),
      voteAverage: show.vote_average,
      voteCount: show.vote_count,
    }

    return NextResponse.json(transformedShow)
  } catch (error) {
    console.error("TMDB TV details error:", error)
    return NextResponse.json(
      { error: "Failed to fetch TV show details" },
      { status: 500 }
    )
  }
}


