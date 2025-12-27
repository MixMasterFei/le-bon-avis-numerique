import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/recommendations/family?memberIds=id1,id2,id3
// Get recommendations for multiple family members (movie night mode)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberIdsParam = searchParams.get("memberIds")

    if (!memberIdsParam) {
      return NextResponse.json({ error: "memberIds requis (séparés par des virgules)" }, { status: 400 })
    }

    const memberIds = memberIdsParam.split(",").map(id => id.trim()).filter(Boolean)

    if (memberIds.length < 2) {
      return NextResponse.json({ error: "Au moins 2 membres requis pour les recommandations familiales" }, { status: 400 })
    }

    // Fetch all selected family members with their reactions
    const familyMembers = await prisma.familyMember.findMany({
      where: {
        id: { in: memberIds },
        userId: session.user.id,
      },
      include: {
        reactions: {
          where: {
            reaction: { in: ["LOVED", "LIKED"] },
          },
          include: {
            media: {
              select: {
                id: true,
                title: true,
                type: true,
                genres: true,
                topics: true,
                expertAgeRec: true,
              },
            },
          },
        },
      },
    })

    if (familyMembers.length < 2) {
      return NextResponse.json({ error: "Membres non trouvés" }, { status: 404 })
    }

    // Calculate youngest child's age (for age-appropriate filtering)
    const currentYear = new Date().getFullYear()
    let youngestAge: number | null = null

    for (const member of familyMembers) {
      if (member.birthYear) {
        const age = currentYear - member.birthYear
        if (youngestAge === null || age < youngestAge) {
          youngestAge = age
        }
      }
    }

    // Collect genre preferences per member
    const memberPreferences: Record<string, {
      genres: Record<string, number>
      mediaIds: Set<string>
      hasReactions: boolean
    }> = {}

    for (const member of familyMembers) {
      const genres: Record<string, number> = {}
      const mediaIds = new Set<string>()

      for (const reaction of member.reactions) {
        mediaIds.add(reaction.media.id)
        const weight = reaction.reaction === "LOVED" ? 2 : 1

        for (const genre of reaction.media.genres) {
          genres[genre] = (genres[genre] || 0) + weight
        }
        // Also consider topics
        for (const topic of reaction.media.topics) {
          genres[topic] = (genres[topic] || 0) + weight
        }
      }

      memberPreferences[member.id] = {
        genres,
        mediaIds,
        hasReactions: member.reactions.length > 0,
      }
    }

    // Find common genres (intersection weighted by how many members like them)
    const combinedGenres: Record<string, { score: number; memberCount: number }> = {}

    for (const [memberId, prefs] of Object.entries(memberPreferences)) {
      for (const [genre, score] of Object.entries(prefs.genres)) {
        if (!combinedGenres[genre]) {
          combinedGenres[genre] = { score: 0, memberCount: 0 }
        }
        combinedGenres[genre].score += score
        combinedGenres[genre].memberCount += 1
      }
    }

    // Prioritize genres that multiple members enjoy
    const sortedGenres = Object.entries(combinedGenres)
      .sort((a, b) => {
        // First by member count (more members = better)
        if (b[1].memberCount !== a[1].memberCount) {
          return b[1].memberCount - a[1].memberCount
        }
        // Then by total score
        return b[1].score - a[1].score
      })
      .slice(0, 6)
      .map(([genre]) => genre)

    // Collect all media IDs that any member has already seen
    const allSeenMediaIds = new Set<string>()
    for (const prefs of Object.values(memberPreferences)) {
      for (const id of prefs.mediaIds) {
        allSeenMediaIds.add(id)
      }
    }

    // Build age filter
    let ageFilter = {}
    if (youngestAge !== null) {
      ageFilter = {
        OR: [
          { expertAgeRec: null },
          { expertAgeRec: { lte: youngestAge + 1 } },
        ],
      }
    }

    // Find recommendations
    const recommendations = await prisma.mediaItem.findMany({
      where: {
        id: { notIn: Array.from(allSeenMediaIds) },
        type: { in: ["MOVIE", "TV"] }, // Focus on movies/TV for family movie night
        OR: [
          { genres: { hasSome: sortedGenres } },
          { topics: { hasSome: sortedGenres } },
        ],
        ...ageFilter,
      },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        genres: true,
        topics: true,
        expertAgeRec: true,
        releaseDate: true,
        synopsisFr: true,
      },
      orderBy: [
        { expertAgeRec: "asc" },
        { releaseDate: "desc" },
      ],
      take: 20,
    })

    // Score each recommendation and calculate match percentage per member
    const scoredRecommendations = recommendations.map((media) => {
      const allGenresAndTopics = [...media.genres, ...media.topics]

      // Calculate per-member match
      const memberMatches: Record<string, {
        name: string
        avatarEmoji: string
        matchScore: number
        matchPercentage: number
      }> = {}

      let totalMatchScore = 0
      let membersWithReactions = 0

      for (const member of familyMembers) {
        const prefs = memberPreferences[member.id]

        if (!prefs.hasReactions) {
          // Member has no reactions, neutral match
          memberMatches[member.id] = {
            name: member.name,
            avatarEmoji: member.avatarEmoji,
            matchScore: 0,
            matchPercentage: 50, // Neutral
          }
          continue
        }

        membersWithReactions++
        let memberScore = 0
        let maxPossibleScore = 0

        for (const [genre, weight] of Object.entries(prefs.genres)) {
          maxPossibleScore += weight
          if (allGenresAndTopics.includes(genre)) {
            memberScore += weight
          }
        }

        const matchPercentage = maxPossibleScore > 0
          ? Math.round((memberScore / maxPossibleScore) * 100)
          : 50

        memberMatches[member.id] = {
          name: member.name,
          avatarEmoji: member.avatarEmoji,
          matchScore: memberScore,
          matchPercentage,
        }

        totalMatchScore += matchPercentage
      }

      // Overall family match (average of all members with reactions)
      const familyMatchPercentage = membersWithReactions > 0
        ? Math.round(totalMatchScore / membersWithReactions)
        : 50

      return {
        ...media,
        memberMatches,
        familyMatchPercentage,
      }
    })

    // Sort by family match percentage
    scoredRecommendations.sort((a, b) => b.familyMatchPercentage - a.familyMatchPercentage)

    return NextResponse.json({
      familyMembers: familyMembers.map(m => ({
        id: m.id,
        name: m.name,
        avatarEmoji: m.avatarEmoji,
        birthYear: m.birthYear,
        hasReactions: memberPreferences[m.id].hasReactions,
      })),
      recommendations: scoredRecommendations.slice(0, 12),
      sharedGenres: sortedGenres,
      youngestAge,
    })
  } catch (error) {
    console.error("Error generating family recommendations:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
