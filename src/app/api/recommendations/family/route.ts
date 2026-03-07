import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"

// --- Scoring helpers (aligned with batch-family-fit & single family-fit) ---

const GENTLE_TONES = new Set([
  "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré",
  "Drôle et léger", "Inspiré et motivant",
])
const DARK_TONES = new Set([
  "Sombre et tendu", "Effrayant et angoissant", "Action intense",
])

function computeAgeScore(expertAgeRec: number | null, memberAge: number | null, tmdbRating?: number | null): number {
  if (expertAgeRec == null || memberAge == null) return 0.5
  if (expertAgeRec > memberAge + 1) return 0.2
  if (expertAgeRec > memberAge) return 0.7
  const gap = memberAge - expertAgeRec
  if (gap <= 3) return 1.0
  if (memberAge >= 16 && expertAgeRec >= 10) return 1.0
  const rawPenalty = (gap - 3) * 0.10
  let score = Math.max(0.30, 1.0 - rawPenalty)
  const rating = tmdbRating ?? 0
  if (rating >= 7.5) {
    const boost = Math.min(0.25, (rating - 7.5) * 0.15)
    score = Math.min(1.0, score + boost)
  }
  return score
}

function computeSensitivityScore(
  metrics: { violence: number; sexNudity: number; language: number; substanceUse: number },
  member: { sensitivityViolence: number; sensitivitySexual: number; sensitivityLanguage: number; sensitivitySubstances: number }
): number {
  const pairs: [number, number][] = [
    [metrics.violence, member.sensitivityViolence],
    [metrics.sexNudity, member.sensitivitySexual],
    [metrics.language, member.sensitivityLanguage],
    [metrics.substanceUse, member.sensitivitySubstances],
  ]
  let total = 0
  let count = 0
  for (const [metricValue, tolerance] of pairs) {
    const effectiveTolerance = tolerance === 0 ? 2 : tolerance
    const threshold = 4 - effectiveTolerance
    const over = Math.max(0, metricValue - threshold)
    total += Math.max(0, 1 - over * 0.25)
    count++
  }
  return count === 0 ? 1.0 : total / count
}

function computeGenreScore(mediaGenres: string[], favoriteGenres: string[], dislikedGenres: string[] = []): number {
  if (favoriteGenres.length === 0 && dislikedGenres.length === 0) return 0.5
  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaGenres.map(normalise))
  let score = 0.5
  if (favoriteGenres.length > 0) {
    const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
    score = Math.min(1.0, matching / Math.max(1, Math.min(3, favoriteGenres.length)))
  }
  if (dislikedGenres.length > 0) {
    const dislikedMatches = dislikedGenres.filter((g) => mediaSet.has(normalise(g))).length
    score = Math.max(0, score - dislikedMatches * 0.3)
  }
  return score
}

function computeInterestsScore(mediaTopics: string[], emotionalThemes: string[], memberInterests: string[]): number {
  if (memberInterests.length === 0) return 0.5
  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaTagSet = new Set([...mediaTopics, ...emotionalThemes].map(normalise))
  const matching = memberInterests.filter((i) => mediaTagSet.has(normalise(i))).length
  if (matching === 0) return 0.3
  return Math.min(1.0, 0.4 + matching * 0.2)
}

function computePositiveContentScore(
  metrics: { positiveMessages: number; roleModels: number },
  member: { preferPositiveMessages: number; preferRoleModels: number; preferEducational: number },
  mediaTopics: string[]
): number {
  if (member.preferPositiveMessages <= 1 && member.preferRoleModels <= 1 && member.preferEducational <= 1) return 0.5
  let score = 0.5
  if (member.preferPositiveMessages >= 2) {
    if (metrics.positiveMessages >= 4) score += 0.2
    else if (metrics.positiveMessages >= 3) score += 0.1
    else if (member.preferPositiveMessages === 3 && metrics.positiveMessages < 2) score -= 0.15
  }
  if (member.preferRoleModels >= 2) {
    if (metrics.roleModels >= 4) score += 0.2
    else if (metrics.roleModels >= 3) score += 0.1
    else if (member.preferRoleModels === 3 && metrics.roleModels < 2) score -= 0.15
  }
  if (member.preferEducational >= 2) {
    const isEducational = mediaTopics.some((t) => t === "Éducatif" || t === "Documentaire")
    if (isEducational) score += 0.25
    else if (member.preferEducational === 3) score -= 0.1
  }
  return Math.max(0, Math.min(1, score))
}

function computeAvoidScore(mediaTopics: string[], avoidTopics: string[]): number {
  if (avoidTopics.length === 0) return 1.0
  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaTopics.map(normalise))
  return avoidTopics.some((t) => mediaSet.has(normalise(t))) ? 0 : 1.0
}

function computeToneScore(
  toneTags: string[], pacing: string | null,
  memberAge: number | null, sensitivityScary: number
): number {
  if (toneTags.length === 0 && !pacing) return 0.5
  let score = 0.5
  const hasGentle = toneTags.some((t) => GENTLE_TONES.has(t))
  const hasDark = toneTags.some((t) => DARK_TONES.has(t))
  if (memberAge !== null && memberAge < 7) {
    if (hasGentle) score += 0.3
    if (hasDark) score -= 0.4
  } else if (memberAge !== null && memberAge < 13) {
    if (hasGentle) score += 0.15
    if (hasDark && sensitivityScary >= 2) score -= 0.3
    else if (hasDark) score -= 0.1
  } else {
    if (hasGentle) score += 0.05
    if (hasDark && sensitivityScary >= 3) score -= 0.15
  }
  if (pacing && memberAge !== null && memberAge < 5) {
    if (pacing === "Rapide et frénétique") score -= 0.2
    else if (pacing === "Dynamique") score -= 0.05
    else if (pacing === "Très calme" || pacing === "Lent et contemplatif") score += 0.1
  }
  return Math.max(0, Math.min(1, score))
}

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

      // Extract top 5 genres by weight
      const topGenres = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre]) => genre)

      const memberAge = getMemberAge(member.birthYear, member.birthMonth)

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

          const ageScore = computeAgeScore(media.expertAgeRec, prefs.age, media.tmdbRating)

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
                prefs.positivePrefs,
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

          // Same weights as batch-family-fit & single family-fit
          const rawScore =
            ageScore * 0.30 +
            sensitivityScore * 0.25 +
            genreScore * 0.10 +
            interestsScore * 0.10 +
            0.10 * 0.5 + // affinity neutral (no reaction history in batch mode)
            toneScore * 0.05 +
            positiveScore * 0.05 +
            avoidScore * 0.05

          const finalPercentage = Math.round(Math.max(0, Math.min(100, rawScore * 100)))

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
