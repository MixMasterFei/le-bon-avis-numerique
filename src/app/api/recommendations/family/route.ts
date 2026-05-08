import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import {
  applyFitGuardrails,
  clampScore,
  computeAgeScore,
  computeAvoidScore,
  computeGenreScore,
  computeInterestsScore,
  computeMatureContentPenalty,
  computePositiveContentScore,
  computeSensitivityScore,
  computeToneScore,
  computeWeightedFitScore,
  DEFAULT_GENRES_BY_AGE,
  getAgeGroup,
  hasRichProfile,
  hasYouthAppealSignal,
  isAdultLeaningContentForMinor,
} from "@/lib/family-fit-score"

// --- Scoring helpers (aligned with batch-family-fit & single family-fit) ---

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
    let youngestAge: number | null = null

    for (const member of familyMembers) {
      const age = getMemberAge(member.birthYear, member.birthMonth)
      if (age != null && (youngestAge === null || age < youngestAge)) {
        youngestAge = age
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

      const memberAge = getMemberAge(member.birthYear, member.birthMonth)

      // Extract top 5 genres by weight
      let topGenres = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre]) => genre)

      // When no reactions and no quiz, use age-appropriate defaults
      // so that sortedGenres isn't empty and the DB query filters to relevant content
      const hasPreferences = member.reactions.length > 0 || hasRichProfile(member)
      if (!hasPreferences && topGenres.length === 0) {
        topGenres = DEFAULT_GENRES_BY_AGE[getAgeGroup(memberAge)]
        // Also add to allGenres map so they contribute to shared genre scoring
        for (const genre of topGenres) {
          genres[genre] = (genres[genre] || 0) + 1
        }
      }

      memberPreferences[member.id] = {
        topGenres,
        allGenres: genres,
        dislikedGenres: member.dislikedGenres || [],
        avoidTopics: member.avoidTopics || [],
        mediaIds,
        hasPreferences,
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
    // Random skip to vary results on refresh (skip 0-60 of top results)
    const randomSkip = Math.floor(Math.random() * 60)
    const hasGenres = sortedGenres.length > 0
    const recommendations = await prisma.mediaItem.findMany({
      where: {
        id: { notIn: Array.from(allSeenMediaIds) },
        type: "MOVIE",
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
        // Minimum popularity to avoid obscure niche content
        tmdbVoteCount: { gte: 100 },
        ...ageFilter,
      },
      include: {
        contentMetrics: true,
      },
      // Sort by popularity first (mainstream over niche), then quality
      orderBy: [
        { tmdbVoteCount: { sort: "desc", nulls: "last" } },
        { tmdbRating: { sort: "desc", nulls: "last" } },
        { releaseDate: "desc" },
      ],
      skip: randomSkip,
      take: 40, // Fetch more to allow scoring & filtering
    })

    // Collect all disliked genres and avoided topics
    const allDislikedGenres = new Set<string>()
    const allAvoidTopics = new Set<string>()
    for (const prefs of Object.values(memberPreferences)) {
      for (const genre of prefs.dislikedGenres) allDislikedGenres.add(genre)
      for (const topic of prefs.avoidTopics) allAvoidTopics.add(topic)
    }

    // Score each recommendation — same weighted formula as batch-family-fit
    const scoredRecommendations = recommendations
      .filter((media) => {
        const allGenresAndTopics = [...media.genres, ...media.topics]
        return !allGenresAndTopics.some(g => allDislikedGenres.has(g) || allAvoidTopics.has(g))
      })
      .map((media) => {
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

          const ageScore = computeAgeScore(media.expertAgeRec, prefs.age, media.tmdbRating, media.genres, media.topics)

          const maturePenalty = computeMatureContentPenalty(
            media.genres,
            {
              violence: metrics?.violence ?? 0,
              sexNudity: metrics?.sexNudity ?? 0,
            },
            media.expertAgeRec,
            prefs.age,
          )

          if (!prefs.hasPreferences) {
            // No quiz: use age-based scoring instead of hardcoded 50%
            const hasYouthAppeal = hasYouthAppealSignal({
              mediaGenres: media.genres,
              mediaTopics: media.topics,
              memberAge: prefs.age,
            })
            const adultLeaning = isAdultLeaningContentForMinor({
              mediaGenres: media.genres,
              expertAgeRec: media.expertAgeRec,
              memberAge: prefs.age,
              hasYouthAppeal,
            })
            const guarded = applyFitGuardrails({
              score: clampScore(ageScore * maturePenalty.multiplier * 100),
              memberAge: prefs.age,
              expertAgeRec: media.expertAgeRec,
              hasRichProfile: false,
              hasYouthAppeal,
              adultLeaning,
            })
            memberMatches[member.id] = {
              name: member.name,
              avatarEmoji: member.avatarEmoji,
              avatarStyle: member.avatarStyle,
              avatarSeed: member.avatarSeed,
              avatarOptions: member.avatarOptions,
              matchScore: guarded.score,
              matchPercentage: guarded.score,
            }
            totalMatchScore += guarded.score
            membersWithPreferences++
            continue
          }

          membersWithPreferences++

          const sensitivityScore = metrics
            ? computeSensitivityScore(
                { violence: metrics.violence, sexNudity: metrics.sexNudity, language: metrics.language, substanceUse: metrics.substanceUse },
                { sensitivityViolence: prefs.sensitivity.violence, sensitivitySexual: prefs.sensitivity.sexual, sensitivityLanguage: prefs.sensitivity.language, sensitivitySubstances: prefs.sensitivity.substances }
              )
            : 0.5

          const genreScore = computeGenreScore(media.genres, member.favoriteGenres || [], prefs.dislikedGenres)

          const interestsScore = computeInterestsScore(
            media.topics,
            metrics ? ((metrics.emotionalThemes ?? []) as string[]) : [],
            member.interests || []
          )

          const positiveScore = metrics
            ? computePositiveContentScore(
                { positiveMessages: metrics.positiveMessages, roleModels: metrics.roleModels },
                { preferPositiveMessages: prefs.positivePrefs.positiveMessages, preferRoleModels: prefs.positivePrefs.roleModels, preferEducational: prefs.positivePrefs.educational },
                media.topics
              )
            : 0.5

          const avoidScore = computeAvoidScore(media.topics, prefs.avoidTopics)

          const toneScore = metrics
            ? computeToneScore(
                (metrics.toneTags ?? []) as string[],
                (metrics.pacing ?? null) as string | null,
                prefs.age,
                prefs.sensitivity.scary
              )
            : 0.5
          const hasYouthAppeal = hasYouthAppealSignal({
            mediaGenres: media.genres,
            mediaTopics: media.topics,
            memberAge: prefs.age,
            genreScore,
            interestsScore,
            positiveScore,
          })
          const adultLeaning = isAdultLeaningContentForMinor({
            mediaGenres: media.genres,
            expertAgeRec: media.expertAgeRec,
            memberAge: prefs.age,
            hasYouthAppeal,
          })

          const finalPercentage = applyFitGuardrails({
            score: clampScore(
              computeWeightedFitScore({
                ageScore,
                sensitivityScore,
                genreScore,
                interestsScore,
                affinityScore: 0.5,
                toneScore,
                positiveScore,
                avoidScore,
              }) * maturePenalty.multiplier
            ),
            memberAge: prefs.age,
            expertAgeRec: media.expertAgeRec,
            hasRichProfile: hasRichProfile(member),
            hasYouthAppeal,
            adultLeaning,
          }).score

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
        birthMonth: m.birthMonth,
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
