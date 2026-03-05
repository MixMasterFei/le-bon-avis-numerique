import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"

interface MemberPreferences {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  favoriteGenres: string[]
  dislikedGenres: string[]
  avoidTopics: string[]
}

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

// getMemberAge imported from @/lib/age-utils

// Calculate compatibility score for a single member against a media item
function calculateMemberScore(
  member: MemberPreferences,
  media: {
    expertAgeRec: number | null
    violence: number
    sexNudity: number
    language: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    genres: string[]
    topics: string[]
  }
): { score: number; concerns: string[] } {
  let score = 100
  const concerns: string[] = []

  const memberAge = getMemberAge(member.birthYear, member.birthMonth)

  // Age appropriateness check (major penalty if content is too mature)
  if (memberAge !== null && media.expertAgeRec !== null) {
    const ageDiff = media.expertAgeRec - memberAge
    if (ageDiff > 3) {
      // Content is 3+ years too mature
      score -= 40
      concerns.push(`Contenu recommandé ${media.expertAgeRec}+ ans (enfant: ${memberAge} ans)`)
    } else if (ageDiff > 1) {
      // Content is 1-3 years too mature
      score -= 20
      concerns.push(`Un peu mature pour ${memberAge} ans`)
    } else if (ageDiff < -5) {
      // Content might be too young
      score -= 10
      concerns.push("Contenu potentiellement trop jeune")
    }
  }

  // Sensitivity checks (0 = don't care, 1 = low tolerance, 2 = moderate, 3 = strict)
  const sensitivityChecks = [
    { name: "Violence", memberSensitivity: member.sensitivityViolence, contentLevel: media.violence },
    { name: "Contenu sexuel", memberSensitivity: member.sensitivitySexual, contentLevel: media.sexNudity },
    { name: "Langage", memberSensitivity: member.sensitivityLanguage, contentLevel: media.language },
    { name: "Drogues/Alcool", memberSensitivity: member.sensitivitySubstances, contentLevel: media.substanceUse },
  ]

  for (const check of sensitivityChecks) {
    if (check.memberSensitivity === 0) continue // Don't care

    // Sensitivity threshold: strict (3) = max content level 1, moderate (2) = max level 2, low (1) = max level 3
    const maxAllowedLevel = 4 - check.memberSensitivity

    if (check.contentLevel > maxAllowedLevel) {
      const excess = check.contentLevel - maxAllowedLevel
      score -= excess * 15
      if (check.contentLevel >= 4) {
        concerns.push(`${check.name} elevé(e) (${check.contentLevel}/5)`)
      } else if (check.contentLevel >= 3) {
        concerns.push(`${check.name} modéré(e)`)
      }
    }
  }

  // Scary content check (using violence as proxy since we don't have a dedicated scary metric)
  // In a real implementation, you might want to use genres or topics to detect scary content
  if (member.sensitivityScary > 0) {
    const scaryIndicators = media.topics.some(t =>
      ["Horreur", "Thriller", "Zombies", "Fantômes", "Halloween"].includes(t)
    ) || media.genres.some(g => ["Horreur", "Thriller"].includes(g))

    if (scaryIndicators && member.sensitivityScary >= 2) {
      score -= 25
      concerns.push("Contenu potentiellement effrayant")
    }
  }

  // Positive content boosts
  const positiveChecks = [
    { name: "Messages positifs", preference: member.preferPositiveMessages, contentLevel: media.positiveMessages },
    { name: "Modèles de comportement", preference: member.preferRoleModels, contentLevel: media.roleModels },
  ]

  for (const check of positiveChecks) {
    if (check.preference === 0) continue
    if (check.preference === 3 && check.contentLevel < 3) {
      // Must have high positive content but doesn't
      score -= 10
    } else if (check.contentLevel >= 4) {
      // Has great positive content
      score += 5
    }
  }

  // Educational preference
  if (member.preferEducational >= 2) {
    const isEducational = media.topics.includes("Éducatif") || media.genres.includes("Documentaire")
    if (isEducational) {
      score += 10
    }
  }

  // Genre matching
  const genreBoost = member.favoriteGenres.filter(g => media.genres.includes(g)).length * 5
  const genrePenalty = member.dislikedGenres.filter(g => media.genres.includes(g)).length * 15
  score += genreBoost - genrePenalty

  if (genrePenalty > 0) {
    const dislikedFound = member.dislikedGenres.filter(g => media.genres.includes(g))
    concerns.push(`Genre non apprécié: ${dislikedFound.join(", ")}`)
  }

  // Topic avoidance (heavy penalty)
  const avoidedTopicsFound = member.avoidTopics.filter(t =>
    media.topics.includes(t) || media.genres.includes(t)
  )
  if (avoidedTopicsFound.length > 0) {
    score -= avoidedTopicsFound.length * 25
    concerns.push(`Thème à éviter: ${avoidedTopicsFound.join(", ")}`)
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score))

  return { score, concerns }
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
      }
    })

    // Find the youngest member's age for initial filtering
    const ages = memberPreferences.map(m => getMemberAge(m.birthYear, m.birthMonth)).filter(a => a !== null) as number[]
    const youngestAge = ages.length > 0 ? Math.min(...ages) : null

    // Build initial query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: Record<string, any> = {
      type: mediaType,
    }

    // Pre-filter by age: use explicit maxAge if provided, else youngest member's age + 3
    if (typeof maxAge === "number") {
      whereClause.expertAgeRec = { ...(whereClause.expertAgeRec || {}), lte: maxAge }
    } else if (youngestAge !== null) {
      whereClause.expertAgeRec = { lte: youngestAge + 3 }
    }
    if (typeof minAge === "number" && minAge > 0) {
      whereClause.expertAgeRec = { ...(whereClause.expertAgeRec || {}), gte: minAge }
    }

    if (genres.length > 0) {
      whereClause.genres = { hasSome: genres }
    }

    if (platforms.length > 0) {
      whereClause.platforms = { hasSome: platforms }
    }

    if (topics.length > 0) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { topics: { hasSome: topics } },
            { genres: { hasSome: topics } },
          ]
        }
      ]
    }

    if (search && typeof search === "string" && search.trim().length >= 2) {
      whereClause.title = { contains: search.trim(), mode: "insensitive" }
    }

    if (requirePoster) {
      whereClause.posterUrl = { not: null }
    }

    if (language) {
      const langs = language.split(",").map((l: string) => l.trim()).filter(Boolean)
      if (langs.length > 0) {
        whereClause.originalLanguage = { in: langs }
      }
    }

    // Fetch up to 500 items for accurate scoring and pagination
    // Scoring is in-memory arithmetic, so this is fast
    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      include: {
        contentMetrics: true,
      },
      take: 500,
      orderBy: [
        { dataQualityScore: "desc" },
        { isEnriched: "desc" },
        { title: "asc" },
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
        })

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

    // Sort by family score and apply pagination
    results.sort((a, b) => b.familyScore - a.familyScore)
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
