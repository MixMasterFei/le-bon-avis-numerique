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

    // Fetch all selected family members with their reactions and preferences
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

    // Collect genre preferences per member (from reactions AND explicit preferences)
    // Use only top 5 genres per member to avoid dilution
    const memberPreferences: Record<string, {
      topGenres: string[]  // Top 5 weighted genres only
      allGenres: Record<string, number>
      dislikedGenres: string[]
      avoidTopics: string[]
      mediaIds: Set<string>
      hasPreferences: boolean
      age: number | null
      sensitivity: {
        violence: number
        scary: number
        sexual: number
        language: number
        substances: number
      }
      positivePrefs: {
        positiveMessages: number
        roleModels: number
        educational: number
      }
    }> = {}

    for (const member of familyMembers) {
      const genres: Record<string, number> = {}
      const mediaIds = new Set<string>()

      // Add explicit favorite genres with high weight
      const favoriteGenres = member.favoriteGenres || []
      for (const genre of favoriteGenres) {
        genres[genre] = (genres[genre] || 0) + 3
      }

      // Add genres from reactions
      for (const reaction of member.reactions) {
        mediaIds.add(reaction.media.id)
        const weight = reaction.reaction === "LOVED" ? 2 : 1
        for (const genre of reaction.media.genres) {
          genres[genre] = (genres[genre] || 0) + weight
        }
        for (const topic of reaction.media.topics) {
          genres[topic] = (genres[topic] || 0) + weight
        }
      }

      // Extract top 5 genres by weight
      const topGenres = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre]) => genre)

      const memberAge = member.birthYear ? currentYear - member.birthYear : null

      memberPreferences[member.id] = {
        topGenres,
        allGenres: genres,
        dislikedGenres: member.dislikedGenres || [],
        avoidTopics: member.avoidTopics || [],
        mediaIds,
        hasPreferences: member.reactions.length > 0 || favoriteGenres.length > 0,
        age: memberAge,
        sensitivity: {
          violence: member.sensitivityViolence,
          scary: member.sensitivityScary,
          sexual: member.sensitivitySexual,
          language: member.sensitivityLanguage,
          substances: member.sensitivitySubstances,
        },
        positivePrefs: {
          positiveMessages: member.preferPositiveMessages,
          roleModels: member.preferRoleModels,
          educational: member.preferEducational,
        },
      }
    }

    // Find common genres across members, weighted by how many members share them
    const combinedGenres: Record<string, { score: number; memberCount: number }> = {}

    for (const prefs of Object.values(memberPreferences)) {
      for (const genre of prefs.topGenres) {
        if (!combinedGenres[genre]) {
          combinedGenres[genre] = { score: 0, memberCount: 0 }
        }
        combinedGenres[genre].score += prefs.allGenres[genre] || 1
        combinedGenres[genre].memberCount += 1
      }
    }

    // Prioritize genres shared by most members, then by score
    const sortedGenres = Object.entries(combinedGenres)
      .sort((a, b) => {
        if (b[1].memberCount !== a[1].memberCount) return b[1].memberCount - a[1].memberCount
        return b[1].score - a[1].score
      })
      .slice(0, 6)
      .map(([genre]) => genre)

    // Collect all media IDs already seen
    const allSeenMediaIds = new Set<string>()
    for (const prefs of Object.values(memberPreferences)) {
      for (const id of prefs.mediaIds) allSeenMediaIds.add(id)
    }

    // Build age filter
    // When all members are adults (16+), set a floor to avoid toddler/young-child content
    const allAdults = youngestAge !== null && youngestAge >= 16
    let ageFilter = {}
    if (youngestAge !== null) {
      if (allAdults) {
        // Adults: skip very young content, include unrated + teen/adult content
        ageFilter = {
          OR: [
            { expertAgeRec: null },
            { expertAgeRec: { gte: 8 } },
          ],
        }
      } else {
        ageFilter = {
          OR: [
            { expertAgeRec: null },
            { expertAgeRec: { lte: youngestAge + 1 } },
          ],
        }
      }
    }

    // Build query — if no shared genres, fall back to age-appropriate well-rated media
    const hasGenres = sortedGenres.length > 0
    const recommendations = await prisma.mediaItem.findMany({
      where: {
        id: { notIn: Array.from(allSeenMediaIds) },
        type: { in: ["MOVIE", "TV"] },
        ...(hasGenres ? {
          OR: [
            { genres: { hasSome: sortedGenres } },
            { topics: { hasSome: sortedGenres } },
          ],
        } : {}),
        // Require poster for display
        posterUrl: { not: null, startsWith: "http" },
        // Only European-language content
        originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"] },
        ...ageFilter,
      },
      include: {
        contentMetrics: true,
      },
      orderBy: hasGenres
        ? [{ tmdbRating: { sort: "desc", nulls: "last" } }, { releaseDate: "desc" }]
        : [{ tmdbRating: { sort: "desc", nulls: "last" } }],
      take: 40, // Fetch more to allow scoring & filtering
    })

    // Collect all disliked genres and avoided topics
    const allDislikedGenres = new Set<string>()
    const allAvoidTopics = new Set<string>()
    for (const prefs of Object.values(memberPreferences)) {
      for (const genre of prefs.dislikedGenres) allDislikedGenres.add(genre)
      for (const topic of prefs.avoidTopics) allAvoidTopics.add(topic)
    }

    // Score each recommendation with a multi-factor approach:
    // - 50% genre match (top genres only, not all)
    // - 30% content sensitivity compatibility
    // - 20% age appropriateness bonus
    const scoredRecommendations = recommendations
      .filter((media) => {
        const allGenresAndTopics = [...media.genres, ...media.topics]
        return !allGenresAndTopics.some(g => allDislikedGenres.has(g) || allAvoidTopics.has(g))
      })
      .map((media) => {
        const allGenresAndTopics = [...media.genres, ...media.topics]
        const metrics = media.contentMetrics

        const memberMatches: Record<string, {
          name: string
          avatarEmoji: string
          avatarStyle: string | null
          avatarSeed: string | null
          avatarOptions: unknown
          matchScore: number
          matchPercentage: number
        }> = {}

        let totalMatchScore = 0
        let membersWithPreferences = 0

        for (const member of familyMembers) {
          const prefs = memberPreferences[member.id]

          if (!prefs.hasPreferences) {
            memberMatches[member.id] = {
              name: member.name,
              avatarEmoji: member.avatarEmoji,
              avatarStyle: member.avatarStyle,
              avatarSeed: member.avatarSeed,
              avatarOptions: member.avatarOptions,
              matchScore: 0,
              matchPercentage: 50,
            }
            continue
          }

          membersWithPreferences++

          // --- Genre match (50% of score) ---
          const topGenreCount = Math.min(3, prefs.topGenres.length) || 1
          const matchingGenres = prefs.topGenres.filter(g => allGenresAndTopics.includes(g)).length
          const genreScore = Math.min(1, matchingGenres / topGenreCount) // 0-1

          // --- Content sensitivity compatibility (30% of score) ---
          let sensitivityScore = 1.0 // Start at perfect, deduct for issues
          if (metrics) {
            const checks = [
              { level: metrics.violence, tolerance: prefs.sensitivity.violence },
              { level: metrics.sexNudity, tolerance: prefs.sensitivity.sexual },
              { level: metrics.language, tolerance: prefs.sensitivity.language },
              { level: metrics.substanceUse, tolerance: prefs.sensitivity.substances },
            ]
            for (const check of checks) {
              if (check.tolerance === 0) continue // Don't care
              // Content level exceeds tolerance threshold: penalize proportionally
              const threshold = check.tolerance === 3 ? 1 : check.tolerance === 2 ? 2 : 3
              if (check.level > threshold) {
                sensitivityScore -= 0.25 * (check.level - threshold)
              }
            }
            // Bonus for positive content matching preferences
            if (prefs.positivePrefs.positiveMessages >= 2 && metrics.positiveMessages >= 4) {
              sensitivityScore += 0.1
            }
            if (prefs.positivePrefs.roleModels >= 2 && metrics.roleModels >= 4) {
              sensitivityScore += 0.1
            }
            sensitivityScore = Math.max(0, Math.min(1, sensitivityScore))
          }

          // --- Age appropriateness (20% of score) ---
          let ageScore = 0.5 // Neutral if we don't know
          if (prefs.age !== null && media.expertAgeRec !== null) {
            if (prefs.age >= 16 && media.expertAgeRec < 10) {
              // Adult watching young-child content: penalize proportionally
              // expertAgeRec 3 → 0.2, expertAgeRec 7 → 0.4, expertAgeRec 9 → 0.5
              ageScore = 0.1 + (media.expertAgeRec / 10) * 0.4
            } else if (media.expertAgeRec <= prefs.age) {
              ageScore = 1.0 // Content is for their age or younger
            } else if (media.expertAgeRec <= prefs.age + 1) {
              ageScore = 0.7 // Close enough (1 year over)
            } else {
              ageScore = 0.2 // Too old for them
            }
          } else if (media.expertAgeRec !== null && media.expertAgeRec <= 7) {
            // Unknown member age + young content: neutral (don't boost)
            ageScore = 0.5
          }

          // Weighted combination
          const rawScore = (genreScore * 0.50) + (sensitivityScore * 0.30) + (ageScore * 0.20)
          const matchPercentage = Math.min(100, Math.max(0, Math.round(rawScore * 100)))

          // Penalty for disliked genres
          let penalty = 0
          for (const disliked of prefs.dislikedGenres) {
            if (allGenresAndTopics.includes(disliked)) penalty += 15
          }

          const finalPercentage = Math.max(0, matchPercentage - penalty)

          memberMatches[member.id] = {
            name: member.name,
            avatarEmoji: member.avatarEmoji,
            avatarStyle: member.avatarStyle,
            avatarSeed: member.avatarSeed,
            avatarOptions: member.avatarOptions,
            matchScore: finalPercentage,
            matchPercentage: finalPercentage,
          }

          totalMatchScore += finalPercentage
        }

        const familyMatchPercentage = membersWithPreferences > 0
          ? Math.round(totalMatchScore / membersWithPreferences)
          : 50

        return {
          id: media.id,
          title: media.title,
          type: media.type,
          posterUrl: media.posterUrl,
          genres: media.genres,
          topics: media.topics,
          expertAgeRec: media.expertAgeRec,
          releaseDate: media.releaseDate,
          synopsisFr: media.synopsisFr,
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
        avatarStyle: m.avatarStyle,
        avatarSeed: m.avatarSeed,
        avatarOptions: m.avatarOptions,
        birthYear: m.birthYear,
        hasReactions: memberPreferences[m.id].hasPreferences,
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
