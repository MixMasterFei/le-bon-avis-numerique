import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import {
  buildSmartFilterWhere,
  calculateMemberScore,
  type MemberPreferences,
} from "./scoring"

interface CompatibilityResult {
  mediaId: string
  title: string
  originalTitle: string | null
  type: string
  posterUrl: string | null
  releaseDate: Date | null
  synopsisFr: string | null
  officialRating: string | null
  expertAgeRec: number | null
  genres: string[]
  topics: string[]
  platforms: string[]
  contentMetrics: Record<string, unknown> | null
  familyScore: number // 0-100 overall family compatibility
  memberScores: {
    memberId: string
    memberName: string
    score: number // 0-100
    concerns: string[] // List of concerns for this member
  }[]
  hasAnyConcerns: boolean
}

// POST /api/filter/smart - Filter media using family preferences
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const {
      familyMemberIds,
      mediaType = "MOVIE",
      limit = 20,
      offset = 0,
      strictMode = false, // If true, ALL members must pass; if false, use average
      minScore = 60, // Minimum family score to include
      genres = [], // Optional genre filter
      platforms = [], // Optional platform filter
      topics = [], // Optional topic filter
      search = "", // Optional text search on title
      requirePoster = false,
      language = "", // e.g. "fr,en"
      minAge, // Optional age range override
      maxAge, // Optional age range override
    } = body

    if (!Array.isArray(familyMemberIds) || familyMemberIds.length === 0) {
      return NextResponse.json(
        { error: "Au moins un membre de la famille doit être sélectionné" },
        { status: 400 }
      )
    }

    // Get selected family members with their preferences
    const familyMembers = await prisma.familyMember.findMany({
      where: {
        id: { in: familyMemberIds },
        userId: session.user.id,
      },
    })

    if (familyMembers.length === 0) {
      return NextResponse.json({ error: "Membres non trouvés" }, { status: 404 })
    }

    // Get family settings for default values
    const familySettings = await prisma.familySettings.findUnique({
      where: { userId: session.user.id },
    })

    // Build effective preferences for each member
    const memberPreferences: MemberPreferences[] = familyMembers.map(member => {
      if (member.useCustomSettings || !familySettings) {
        return {
          id: member.id,
          name: member.name,
          birthYear: member.birthYear,
          birthMonth: member.birthMonth,
          sensitivityViolence: member.sensitivityViolence,
          sensitivityScary: member.sensitivityScary,
          sensitivitySexual: member.sensitivitySexual,
          sensitivityLanguage: member.sensitivityLanguage,
          sensitivitySubstances: member.sensitivitySubstances,
          preferPositiveMessages: member.preferPositiveMessages,
          preferRoleModels: member.preferRoleModels,
          preferEducational: member.preferEducational,
          favoriteGenres: member.favoriteGenres,
          dislikedGenres: member.dislikedGenres,
          avoidTopics: [...member.avoidTopics, ...(familySettings?.blockedTopics || [])],
          interests: member.interests,
        }
      }

      // Use family defaults
      return {
        id: member.id,
        name: member.name,
        birthYear: member.birthYear,
        birthMonth: member.birthMonth,
        sensitivityViolence: familySettings.defaultSensitivityViolence,
        sensitivityScary: familySettings.defaultSensitivityScary,
        sensitivitySexual: familySettings.defaultSensitivitySexual,
        sensitivityLanguage: familySettings.defaultSensitivityLanguage,
        sensitivitySubstances: familySettings.defaultSensitivitySubstances,
        preferPositiveMessages: familySettings.defaultPreferPositiveMessages,
        preferRoleModels: familySettings.defaultPreferRoleModels,
        preferEducational: familySettings.defaultPreferEducational,
        favoriteGenres: member.favoriteGenres,
        dislikedGenres: member.dislikedGenres,
        avoidTopics: [...member.avoidTopics, ...familySettings.blockedTopics],
        interests: member.interests,
      }
    })

    // Find the youngest member's age for initial filtering
    const ages = memberPreferences.map(m => getMemberAge(m.birthYear, m.birthMonth)).filter(a => a !== null) as number[]
    const youngestAge = ages.length > 0 ? Math.min(...ages) : null

    const whereClause = buildSmartFilterWhere({
      mediaType,
      members: memberPreferences,
      genres,
      platforms,
      topics,
      search,
      requirePoster,
      language,
      minAge,
      maxAge,
      youngestAge,
      strictMode,
    })

    // Fetch up to 500 items for accurate scoring and pagination
    // Scoring is in-memory arithmetic, so this is fast
    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      include: {
        contentMetrics: true,
      },
      take: 500,
      orderBy: [
        { tmdbVoteCount: { sort: "desc", nulls: "last" } },
        { tmdbRating: { sort: "desc", nulls: "last" } },
        { dataQualityScore: "desc" },
      ],
    })

    // Calculate compatibility for each media item
    const results: CompatibilityResult[] = []

    for (const media of mediaItems) {
      const metrics = media.contentMetrics || {
        violence: 0,
        sexNudity: 0,
        language: 0,
        substanceUse: 0,
        positiveMessages: 3,
        roleModels: 3,
        emotionalThemes: [] as string[],
      }

      const memberResults = memberPreferences.map(member => {
        const { score, concerns } = calculateMemberScore(member, {
          expertAgeRec: media.expertAgeRec,
          violence: metrics.violence,
          sexNudity: metrics.sexNudity,
          language: metrics.language,
          substanceUse: metrics.substanceUse,
          positiveMessages: metrics.positiveMessages,
          roleModels: metrics.roleModels,
          genres: media.genres,
          topics: media.topics,
          emotionalThemes: (metrics.emotionalThemes ?? []) as string[],
        }, strictMode)

        return {
          memberId: member.id,
          memberName: member.name,
          score,
          concerns,
        }
      })

      // Calculate family score
      let familyScore: number
      if (strictMode) {
        // In strict mode, use the minimum score
        familyScore = Math.min(...memberResults.map(r => r.score))
      } else {
        // Otherwise use the average
        familyScore = memberResults.reduce((sum, r) => sum + r.score, 0) / memberResults.length
      }

      // Skip if below minimum score
      if (familyScore < minScore) continue

      results.push({
        mediaId: media.id,
        title: media.title,
        originalTitle: media.originalTitle,
        type: media.type,
        posterUrl: media.posterUrl,
        releaseDate: media.releaseDate,
        synopsisFr: media.synopsisFr,
        officialRating: media.officialRating,
        expertAgeRec: media.expertAgeRec,
        genres: media.genres,
        topics: media.topics,
        platforms: media.platforms,
        contentMetrics: media.contentMetrics as Record<string, unknown> | null,
        familyScore: Math.round(familyScore),
        memberScores: memberResults,
        hasAnyConcerns: memberResults.some(r => r.concerns.length > 0),
      })
    }

    // Sort by family score, then by popularity as tiebreaker
    // Build a popularity lookup from the original DB results
    const popularityMap = new Map<string, { voteCount: number; rating: number }>()
    for (const media of mediaItems) {
      popularityMap.set(media.id, {
        voteCount: media.tmdbVoteCount ?? 0,
        rating: media.tmdbRating ?? 0,
      })
    }
    results.sort((a, b) => {
      // Primary: family score descending
      if (b.familyScore !== a.familyScore) return b.familyScore - a.familyScore
      // Tiebreaker: popularity (vote count then rating)
      const popA = popularityMap.get(a.mediaId) ?? { voteCount: 0, rating: 0 }
      const popB = popularityMap.get(b.mediaId) ?? { voteCount: 0, rating: 0 }
      if (popB.voteCount !== popA.voteCount) return popB.voteCount - popA.voteCount
      return popB.rating - popA.rating
    })
    const paginatedResults = results.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      members: memberPreferences.map(m => ({ id: m.id, name: m.name })),
      total: results.length,
      offset,
      limit,
      results: paginatedResults,
    })
  } catch (error) {
    console.error("Smart filter error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
