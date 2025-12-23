import { NextRequest, NextResponse } from "next/server"
import { getMovieDetails, getTVDetails, getImageUrl, ImageSize } from "@/lib/tmdb"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

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

// AI-powered content analysis using OpenAI
async function analyzeContentWithAI(movie: {
  title: string
  original_title?: string
  overview: string
  genres: { id: number; name: string }[]
  vote_average: number
  adult: boolean
  release_date: string
}): Promise<GeneratedReview> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const genreNames = movie.genres.map((g) => g.name).join(", ")

  const prompt = `Tu es un expert en evaluation de contenu mediatique pour les familles, similaire a Common Sense Media.
Analyse ce film et fournis une evaluation detaillee pour aider les parents.

FILM:
- Titre: ${movie.title}
- Titre original: ${movie.original_title || movie.title}
- Genres: ${genreNames}
- Date de sortie: ${movie.release_date}
- Note publique: ${movie.vote_average}/10
- Contenu adulte: ${movie.adult ? "Oui" : "Non"}
- Synopsis: ${movie.overview}

Reponds UNIQUEMENT avec un JSON valide (sans markdown) dans ce format exact:
{
  "expertAgeRec": <nombre entre 3 et 18>,
  "contentMetrics": {
    "violence": <0-5>,
    "sexNudity": <0-5>,
    "language": <0-5>,
    "consumerism": <0-5>,
    "substanceUse": <0-5>,
    "positiveMessages": <0-5>,
    "roleModels": <0-5>
  },
  "whatParentsNeedToKnow": [
    "<conseil 1 en francais>",
    "<conseil 2 en francais>",
    "<conseil 3 en francais>"
  ],
  "synopsis": "<resume en francais de 2-3 phrases>"
}

Echelle des metriques: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense

Sois precis et base ton analyse sur les genres et le synopsis fournis.`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(cleanedContent)

    // Validate and clamp values
    return {
      expertAgeRec: Math.min(18, Math.max(3, parsed.expertAgeRec || 8)),
      contentMetrics: {
        violence: Math.min(5, Math.max(0, parsed.contentMetrics?.violence || 0)),
        sexNudity: Math.min(5, Math.max(0, parsed.contentMetrics?.sexNudity || 0)),
        language: Math.min(5, Math.max(0, parsed.contentMetrics?.language || 0)),
        consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
        substanceUse: Math.min(5, Math.max(0, parsed.contentMetrics?.substanceUse || 0)),
        positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
        roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
      },
      whatParentsNeedToKnow: Array.isArray(parsed.whatParentsNeedToKnow)
        ? parsed.whatParentsNeedToKnow.slice(0, 5)
        : [],
      synopsis: parsed.synopsis || movie.overview,
    }
  } catch (error) {
    console.error("OpenAI analysis failed, falling back to heuristics:", error)
    return analyzeContentFromMetadata(movie)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tmdbId, type = "movie", forceRegenerate = false } = body

    if (!tmdbId) {
      return NextResponse.json(
        { error: "tmdbId is required" },
        { status: 400 }
      )
    }

    // Check if already exists in database
    const existingItem = await prisma.mediaItem.findUnique({
      where: { tmdbId: Number(tmdbId) },
      include: { contentMetrics: true },
    })

    if (existingItem && !forceRegenerate) {
      // Return existing data
      return NextResponse.json({
        success: true,
        data: {
          id: existingItem.id,
          tmdbId: existingItem.tmdbId,
          title: existingItem.title,
          originalTitle: existingItem.originalTitle,
          type: existingItem.type,
          releaseDate: existingItem.releaseDate?.toISOString().split("T")[0],
          posterUrl: existingItem.posterUrl,
          backdropUrl: existingItem.backdropUrl,
          synopsisFr: existingItem.synopsisFr,
          genres: existingItem.genres,
          duration: existingItem.duration,
          director: existingItem.director,
          expertAgeRec: existingItem.expertAgeRec,
          contentMetrics: existingItem.contentMetrics ? {
            violence: existingItem.contentMetrics.violence,
            sexNudity: existingItem.contentMetrics.sexNudity,
            language: existingItem.contentMetrics.language,
            consumerism: existingItem.contentMetrics.consumerism,
            substanceUse: existingItem.contentMetrics.substanceUse,
            positiveMessages: existingItem.contentMetrics.positiveMessages,
            roleModels: existingItem.contentMetrics.roleModels,
          } : null,
          whatParentsNeedToKnow: existingItem.contentMetrics?.whatParentsNeedToKnow || [],
        },
        source: "database",
        note: "Cette evaluation existe deja dans la base de donnees.",
      })
    }

    // Fetch details from TMDB based on type
    const mediaType = type.toLowerCase()
    let movie: {
      id: number
      title: string
      original_title: string
      overview: string
      poster_path: string | null
      backdrop_path: string | null
      release_date: string
      genres: { id: number; name: string }[]
      vote_average: number
      adult: boolean
      runtime?: number
      credits?: { crew?: { job: string; name: string }[] }
    }

    if (mediaType === "tv") {
      const tv = await getTVDetails(Number(tmdbId))
      movie = {
        id: tv.id,
        title: tv.name,
        original_title: tv.original_name,
        overview: tv.overview,
        poster_path: tv.poster_path,
        backdrop_path: tv.backdrop_path,
        release_date: tv.first_air_date,
        genres: tv.genres,
        vote_average: tv.vote_average,
        adult: false,
        runtime: tv.episode_run_time?.[0],
      }
    } else {
      movie = await getMovieDetails(Number(tmdbId))
    }

    // Generate content analysis (AI if available, otherwise heuristics)
    let analysis: GeneratedReview
    let analysisMethod: string

    if (process.env.OPENAI_API_KEY) {
      analysis = await analyzeContentWithAI(movie)
      analysisMethod = "openai"
    } else {
      analysis = analyzeContentFromMetadata(movie)
      analysisMethod = "heuristic"
    }

    // Save to database
    const savedItem = await prisma.mediaItem.upsert({
      where: { tmdbId: movie.id },
      update: {
        title: movie.title,
        originalTitle: movie.original_title,
        type: mediaType.toUpperCase() as "MOVIE" | "TV",
        releaseDate: movie.release_date ? new Date(movie.release_date) : null,
        posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
        backdropUrl: getImageUrl(movie.backdrop_path, ImageSize.backdrop.large),
        synopsisFr: analysis.synopsis,
        genres: movie.genres.map((g) => g.name),
        duration: movie.runtime,
        director: movie.credits?.crew?.find((c) => c.job === "Director")?.name,
        expertAgeRec: analysis.expertAgeRec,
        updatedAt: new Date(),
      },
      create: {
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        type: mediaType.toUpperCase() as "MOVIE" | "TV",
        releaseDate: movie.release_date ? new Date(movie.release_date) : null,
        posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.medium),
        backdropUrl: getImageUrl(movie.backdrop_path, ImageSize.backdrop.large),
        synopsisFr: analysis.synopsis,
        genres: movie.genres.map((g) => g.name),
        platforms: [],
        topics: [],
        duration: movie.runtime,
        director: movie.credits?.crew?.find((c) => c.job === "Director")?.name,
        expertAgeRec: analysis.expertAgeRec,
      },
    })

    // Save or update content metrics
    await prisma.contentMetrics.upsert({
      where: { mediaId: savedItem.id },
      update: {
        violence: analysis.contentMetrics.violence,
        sexNudity: analysis.contentMetrics.sexNudity,
        language: analysis.contentMetrics.language,
        consumerism: analysis.contentMetrics.consumerism,
        substanceUse: analysis.contentMetrics.substanceUse,
        positiveMessages: analysis.contentMetrics.positiveMessages,
        roleModels: analysis.contentMetrics.roleModels,
        whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
        updatedAt: new Date(),
      },
      create: {
        mediaId: savedItem.id,
        violence: analysis.contentMetrics.violence,
        sexNudity: analysis.contentMetrics.sexNudity,
        language: analysis.contentMetrics.language,
        consumerism: analysis.contentMetrics.consumerism,
        substanceUse: analysis.contentMetrics.substanceUse,
        positiveMessages: analysis.contentMetrics.positiveMessages,
        roleModels: analysis.contentMetrics.roleModels,
        whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
      },
    })

    // Build the response
    const result = {
      id: savedItem.id,
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      type: mediaType.toUpperCase(),
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
      source: "generated",
      analysisMethod,
      note: analysisMethod === "openai"
        ? "Evaluation generee par IA et sauvegardee en base de donnees."
        : "Evaluation generee par heuristique et sauvegardee. Ajoutez OPENAI_API_KEY pour de meilleurs resultats.",
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
    message: "POST to this endpoint with { tmdbId: number, type?: 'movie' | 'tv', forceRegenerate?: boolean } to generate a content review",
    example: { tmdbId: 420818, type: "movie" },
    notes: [
      "Si l'item existe deja en base, il sera retourne sans regeneration (sauf si forceRegenerate=true)",
      "L'analyse utilise OpenAI si OPENAI_API_KEY est configure, sinon des heuristiques",
      "Les donnees sont automatiquement sauvegardees en base de donnees",
    ],
  })
}
