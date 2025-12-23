import { NextRequest, NextResponse } from "next/server"
import { getMovieDetails, getImageUrl, ImageSize } from "@/lib/tmdb"

// This endpoint generates AI-powered content reviews for movies
// It uses the movie data from TMDB and generates age recommendations and content analysis

interface GeneratedReview {
  expertAgeRec: number
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
  }
  whatParentsNeedToKnow: string[]
  synopsis: string
}

// Simple heuristic-based content analysis when AI is not available
function analyzeContentFromMetadata(movie: {
  title: string
  overview: string
  genres: { id: number; name: string }[]
  vote_average: number
  adult: boolean
  release_date: string
}): GeneratedReview {
  const genreIds = movie.genres.map((g) => g.id)
  const overview = movie.overview.toLowerCase()

  // Genre IDs from TMDB
  const ACTION = 28
  const HORROR = 27
  const THRILLER = 53
  const WAR = 10752
  const CRIME = 80
  const ANIMATION = 16
  const FAMILY = 10751
  const COMEDY = 35
  const ROMANCE = 10749
  const DOCUMENTARY = 99

  // Base scores
  let violence = 1
  let sexNudity = 0
  let language = 1
  let consumerism = 1
  let substanceUse = 0
  let positiveMessages = 3
  let roleModels = 3

  // Adjust based on genres
  if (genreIds.includes(ACTION)) violence += 2
  if (genreIds.includes(HORROR)) { violence += 3; positiveMessages -= 1 }
  if (genreIds.includes(THRILLER)) { violence += 1; language += 1 }
  if (genreIds.includes(WAR)) { violence += 3; substanceUse += 1 }
  if (genreIds.includes(CRIME)) { violence += 2; language += 2; substanceUse += 1 }
  if (genreIds.includes(ANIMATION)) { violence = Math.max(0, violence - 1); positiveMessages += 1 }
  if (genreIds.includes(FAMILY)) { positiveMessages += 2; roleModels += 1; violence = Math.max(0, violence - 1) }
  if (genreIds.includes(COMEDY)) { positiveMessages += 1 }
  if (genreIds.includes(ROMANCE)) { sexNudity += 1 }
  if (genreIds.includes(DOCUMENTARY)) { positiveMessages += 1; roleModels += 1 }

  // Check overview for keywords
  const violentWords = ["kill", "murder", "death", "blood", "fight", "war", "battle", "weapon", "gun"]
  const sexualWords = ["love", "romance", "kiss", "relationship", "affair"]
  const substanceWords = ["drug", "alcohol", "drink", "smoke", "addiction"]

  violentWords.forEach((word) => {
    if (overview.includes(word)) violence += 0.5
  })
  sexualWords.forEach((word) => {
    if (overview.includes(word)) sexNudity += 0.3
  })
  substanceWords.forEach((word) => {
    if (overview.includes(word)) substanceUse += 0.5
  })

  // Clamp all values between 0-5
  violence = Math.min(5, Math.max(0, Math.round(violence)))
  sexNudity = Math.min(5, Math.max(0, Math.round(sexNudity)))
  language = Math.min(5, Math.max(0, Math.round(language)))
  consumerism = Math.min(5, Math.max(0, Math.round(consumerism)))
  substanceUse = Math.min(5, Math.max(0, Math.round(substanceUse)))
  positiveMessages = Math.min(5, Math.max(0, Math.round(positiveMessages)))
  roleModels = Math.min(5, Math.max(0, Math.round(roleModels)))

  // Calculate age recommendation
  let expertAgeRec = 6 // Default for family content

  if (movie.adult) expertAgeRec = 18
  else if (violence >= 4 || sexNudity >= 3) expertAgeRec = 16
  else if (violence >= 3 || sexNudity >= 2 || language >= 3) expertAgeRec = 13
  else if (violence >= 2 || substanceUse >= 2) expertAgeRec = 10
  else if (genreIds.includes(FAMILY) || genreIds.includes(ANIMATION)) expertAgeRec = 6
  else expertAgeRec = 8

  // Generate "What Parents Need to Know"
  const tips: string[] = []

  if (violence >= 3) tips.push("Contient des scenes de violence qui peuvent etre perturbantes pour les jeunes enfants.")
  if (violence >= 1 && violence < 3) tips.push("Quelques scenes d'action mais sans violence graphique excessive.")
  if (sexNudity >= 2) tips.push("Contient des scenes romantiques ou suggestives.")
  if (language >= 3) tips.push("Langage grossier present dans certaines scenes.")
  if (substanceUse >= 2) tips.push("References a l'alcool ou aux drogues.")
  if (positiveMessages >= 4) tips.push("Messages positifs sur l'amitie, le courage ou la famille.")
  if (roleModels >= 4) tips.push("Personnages inspirants qui peuvent servir de modeles positifs.")
  if (genreIds.includes(FAMILY)) tips.push("Adapte pour un visionnage en famille.")
  if (genreIds.includes(ANIMATION)) tips.push("Animation coloree et engageante pour les enfants.")

  if (tips.length === 0) {
    tips.push("Film de divertissement general adapte a la plupart des publics.")
  }

  return {
    expertAgeRec,
    contentMetrics: {
      violence,
      sexNudity,
      language,
      consumerism,
      substanceUse,
      positiveMessages,
      roleModels,
    },
    whatParentsNeedToKnow: tips.slice(0, 5),
    synopsis: movie.overview,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tmdbId, type = "movie" } = body

    if (!tmdbId) {
      return NextResponse.json(
        { error: "tmdbId is required" },
        { status: 400 }
      )
    }

    // Fetch movie details from TMDB
    const movie = await getMovieDetails(Number(tmdbId))

    // Generate content analysis
    const analysis = analyzeContentFromMetadata(movie)

    // Build the response
    const result = {
      id: String(movie.id),
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      type: type.toUpperCase(),
      releaseDate: movie.release_date,
      posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
      backdropUrl: getImageUrl(movie.backdrop_path, ImageSize.backdrop.large),
      synopsisFr: analysis.synopsis,
      genres: movie.genres.map((g) => g.name),
      duration: movie.runtime,
      director: movie.credits?.crew?.find((c) => c.job === "Director")?.name,
      ...analysis,
    }

    return NextResponse.json({
      success: true,
      data: result,
      note: "Generated using heuristic analysis. For better results, add ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    })
  } catch (error) {
    console.error("Generate review error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate review" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint with { tmdbId: number } to generate a content review",
    example: { tmdbId: 420818 },
  })
}
