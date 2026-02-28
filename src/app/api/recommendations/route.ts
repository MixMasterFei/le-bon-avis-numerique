import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/recommendations?familyMemberId=xxx - Get recommendations for a family member
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyMemberId = searchParams.get("familyMemberId")

    if (!familyMemberId) {
      return NextResponse.json({ error: "familyMemberId requis" }, { status: 400 })
    }

    // Verify ownership
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: familyMemberId,
        userId: session.user.id,
      },
      include: {
        reactions: {
          include: {
            media: {
              select: {
                id: true,
                title: true,
                type: true,
                genres: true,
                expertAgeRec: true,
              },
            },
          },
        },
      },
    })

    if (!familyMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    // Separate positive reactions (for building recommendations) from all reactions (for exclusion)
    const positiveReactions = familyMember.reactions.filter(r => r.reaction === "LOVED" || r.reaction === "LIKED")
    // Exclude any media the member has already reacted to (watched, loved, liked, etc.)
    const allReactedMediaIds = new Set(familyMember.reactions.map(r => r.mediaId))

    // If no positive reactions, return empty recommendations
    if (positiveReactions.length === 0) {
      return NextResponse.json({
        familyMember: {
          id: familyMember.id,
          name: familyMember.name,
          avatarEmoji: familyMember.avatarEmoji,
          birthYear: familyMember.birthYear,
        },
        recommendations: [],
        message: "Ajoutez des réactions positives pour obtenir des recommandations",
      })
    }

    // Calculate child's approximate age
    const currentYear = new Date().getFullYear()
    const childAge = familyMember.birthYear
      ? currentYear - familyMember.birthYear
      : null

    // Collect data from loved/liked media
    const lovedGenres: Record<string, number> = {}

    for (const reaction of positiveReactions) {
      const weight = reaction.reaction === "LOVED" ? 2 : 1
      for (const genre of reaction.media.genres) {
        lovedGenres[genre] = (lovedGenres[genre] || 0) + weight
      }
    }

    // Always recommend across all main media types for diversity
    // (not just the types the user already reacted to)
    const mediaTypes = ["MOVIE", "TV", "GAME"] as const

    // Sort genres by weight
    const topGenres = Object.entries(lovedGenres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre)

    // Build age filter - strict: only recommend content appropriate for child's age
    // Do NOT include items with null age rating - they haven't been reviewed
    const ageFilter = childAge !== null ? {
      expertAgeRec: { lte: childAge }, // Strict: must have age rating AND be <= child's age
    } : {}

    // Step 1: Try to find similar media from MediaSimilarity table
    const lovedMediaIds = new Set(positiveReactions.map(r => r.mediaId))
    const lovedMediaIdsArray = Array.from(lovedMediaIds)
    const similarMedia = await prisma.mediaSimilarity.findMany({
      where: {
        OR: [
          { mediaIdA: { in: lovedMediaIdsArray } },
          { mediaIdB: { in: lovedMediaIdsArray } },
        ],
      },
      include: {
        mediaA: {
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
            genres: true,
            expertAgeRec: true,
            dataQualityScore: true,
          },
        },
        mediaB: {
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
            genres: true,
            expertAgeRec: true,
            dataQualityScore: true,
          },
        },
      },
      orderBy: {
        similarityScore: "desc",
      },
      take: 20,
    })

    // Extract unique similar items (not already reacted to)
    const similarItems = new Map<string, typeof similarMedia[0]["mediaA"] & { similarityScore: number }>()
    for (const sim of similarMedia) {
      const item = lovedMediaIds.has(sim.mediaIdA) ? sim.mediaB : sim.mediaA
      if (!allReactedMediaIds.has(item.id) && !similarItems.has(item.id)) {
        // Check age appropriateness and quality - very strict filtering
        // Must have an age rating AND be appropriate for child's age
        const hasAgeRating = item.expertAgeRec !== null
        const isAgeAppropriate = childAge === null || (hasAgeRating && item.expertAgeRec! <= childAge)
        const isHighQuality = item.dataQualityScore >= 70 // Only mainstream titles

        if (hasAgeRating && isAgeAppropriate && isHighQuality) {
          similarItems.set(item.id, { ...item, similarityScore: sim.similarityScore })
        }
      }
    }

    // Step 2: If not enough similar items, fall back to genre-based recommendations
    let recommendations: Array<{
      id: string
      title: string
      type: string
      posterUrl: string | null
      genres: string[]
      expertAgeRec: number | null
      score: number
    }> = []

    // Add similar items first (they're the best matches)
    for (const [, item] of similarItems) {
      recommendations.push({
        id: item.id,
        title: item.title,
        type: item.type,
        posterUrl: item.posterUrl,
        genres: item.genres,
        expertAgeRec: item.expertAgeRec,
        score: 100 + (item.similarityScore * 50) + (item.dataQualityScore / 10), // High base score for similar items
      })
    }

    // If we need more recommendations, do genre-based search
    if (recommendations.length < 12) {
      const excludeIds = [...Array.from(allReactedMediaIds), ...recommendations.map(r => r.id)]

      const genreBasedMedia = await prisma.mediaItem.findMany({
        where: {
          id: { notIn: excludeIds },
          type: { in: [...mediaTypes] },
          genres: { hasSome: topGenres },
          // Require poster and high quality to filter out obscure indie titles
          posterUrl: { not: null, startsWith: "http" },
          dataQualityScore: { gte: 70 },
          // Only recommend French/English content for French audience
          originalLanguage: { in: ["fr", "en"] },
          ...ageFilter,
        },
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          genres: true,
          expertAgeRec: true,
          dataQualityScore: true,
          releaseDate: true,
        },
        orderBy: [
          { dataQualityScore: "desc" }, // Prioritize mainstream/quality content
          { releaseDate: "desc" },
        ],
        take: 20,
      })

      // Score by genre match + quality
      for (const media of genreBasedMedia) {
        let genreScore = 0
        for (const genre of media.genres) {
          if (lovedGenres[genre]) {
            genreScore += lovedGenres[genre]
          }
        }

        // Combine genre match score with quality score
        const totalScore = genreScore * 10 + (media.dataQualityScore / 2)

        recommendations.push({
          id: media.id,
          title: media.title,
          type: media.type,
          posterUrl: media.posterUrl,
          genres: media.genres,
          expertAgeRec: media.expertAgeRec,
          score: totalScore,
        })
      }
    }

    // Sort by score and take top 8
    recommendations.sort((a, b) => b.score - a.score)
    const finalRecommendations = recommendations.slice(0, 8).map(({ score, ...media }) => media)

    return NextResponse.json({
      familyMember: {
        id: familyMember.id,
        name: familyMember.name,
        avatarEmoji: familyMember.avatarEmoji,
        birthYear: familyMember.birthYear,
      },
      recommendations: finalRecommendations,
      basedOn: {
        genres: topGenres,
        lovedCount: familyMember.reactions.filter((r) => r.reaction === "LOVED").length,
        likedCount: familyMember.reactions.filter((r) => r.reaction === "LIKED").length,
      },
    })
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
