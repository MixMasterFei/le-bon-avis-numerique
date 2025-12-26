import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/recommendations?familyMemberId=xxx - Get AI-based recommendations for a family member
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
          where: {
            reaction: { in: ["LOVED", "LIKED"] }, // Only positive reactions
          },
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

    // If no positive reactions, return empty recommendations
    if (familyMember.reactions.length === 0) {
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

    // Collect genres from loved/liked media
    const lovedGenres: Record<string, number> = {}
    const lovedMediaIds = new Set<string>()
    const mediaTypes: Set<string> = new Set()

    for (const reaction of familyMember.reactions) {
      lovedMediaIds.add(reaction.media.id)
      mediaTypes.add(reaction.media.type)

      const weight = reaction.reaction === "LOVED" ? 2 : 1
      for (const genre of reaction.media.genres) {
        lovedGenres[genre] = (lovedGenres[genre] || 0) + weight
      }
    }

    // Sort genres by weight
    const topGenres = Object.entries(lovedGenres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre)

    // Build age filter - recommend within appropriate age range
    let ageFilter = {}
    if (childAge !== null) {
      // Recommend for their age ± 2 years
      ageFilter = {
        OR: [
          { expertAgeRec: null },
          { expertAgeRec: { lte: childAge + 1 } },
        ],
      }
    }

    // Find similar media
    const recommendations = await prisma.mediaItem.findMany({
      where: {
        id: { notIn: Array.from(lovedMediaIds) }, // Exclude already rated
        type: { in: Array.from(mediaTypes) as ("MOVIE" | "TV" | "GAME" | "BOOK" | "APP")[] },
        genres: { hasSome: topGenres }, // At least one matching genre
        ...ageFilter,
      },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        genres: true,
        expertAgeRec: true,
        releaseDate: true,
      },
      orderBy: [
        { expertAgeRec: "asc" }, // Prioritize age-appropriate content
        { releaseDate: "desc" }, // Then newer content
      ],
      take: 12,
    })

    // Score recommendations by genre match
    const scoredRecommendations = recommendations.map((media) => {
      let score = 0
      for (const genre of media.genres) {
        if (lovedGenres[genre]) {
          score += lovedGenres[genre]
        }
      }
      return { ...media, score }
    })

    // Sort by score and take top recommendations
    scoredRecommendations.sort((a, b) => b.score - a.score)

    return NextResponse.json({
      familyMember: {
        id: familyMember.id,
        name: familyMember.name,
        avatarEmoji: familyMember.avatarEmoji,
        birthYear: familyMember.birthYear,
      },
      recommendations: scoredRecommendations.slice(0, 8).map(({ score, ...media }) => media),
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
