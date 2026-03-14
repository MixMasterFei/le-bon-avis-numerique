import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { COMMUNITY_WARNING_THRESHOLD } from "@/lib/family-warning"
import { getMemberAge } from "@/lib/age-utils"

// ---------------------------------------------------------------------------
// Batch Family Fit API
// Computes fit scores for multiple media items × all family members at once.
// Used by the homepage to show member avatars on cards in a single request.
// ---------------------------------------------------------------------------

// --- Scoring helpers (same logic as single-item family-fit route) ----------

const GENTLE_TONES = new Set([
  "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré",
  "Drôle et léger", "Inspiré et motivant",
])

const DARK_TONES = new Set([
  "Sombre et tendu", "Effrayant et angoissant", "Action intense",
])

function computeAgeScore(expertAgeRec: number | null, memberAge: number | null, tmdbRating?: number | null): number {
  if (expertAgeRec == null || memberAge == null) return 0.5

  // Too young for this content
  if (expertAgeRec > memberAge + 1) return 0.2
  if (expertAgeRec > memberAge) return 0.7

  // Content is at or below viewer's age — penalise large gaps
  // BUT adults watching mature content (10+) is perfectly normal
  const gap = memberAge - expertAgeRec
  if (gap <= 3) return 1.0

  // Adults (16+) watching content rated 10+ → no penalty
  if (memberAge >= 16 && expertAgeRec >= 10) return 1.0

  // Gradual penalty: each year beyond 3 costs 0.10, floor 0.30
  const rawPenalty = (gap - 3) * 0.10
  let score = Math.max(0.30, 1.0 - rawPenalty)

  // Universal-appeal boost for highly-rated content
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
    // tolerance=0 means "not configured" — use moderate default (2) instead of skipping
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

// Genres that should always flag caution, especially for minors
const MATURE_GENRES = new Set(["horreur", "horror", "épouvante", "thriller", "crime"])

function computeMatureContentPenalty(
  mediaGenres: string[],
  metrics: { violence: number; sexNudity: number },
  expertAgeRec: number | null,
  memberAge: number | null
): number {
  const hasMatureGenre = mediaGenres.some((g) => MATURE_GENRES.has(g.toLowerCase()))
  const hasHighViolence = metrics.violence >= 4
  const hasHighSexual = metrics.sexNudity >= 4
  const isMatureContent = hasMatureGenre || hasHighViolence || hasHighSexual

  if (!isMatureContent) return 1.0

  const isMinor = memberAge != null && memberAge < 18
  const isChild = memberAge != null && memberAge < 13

  if (isChild) return 0.25
  if (isMinor) {
    const isAgeAppropriate = expertAgeRec != null && memberAge != null && memberAge >= expertAgeRec
    return isAgeAppropriate ? 0.45 : 0.25
  }
  return 1.0
}

// ---------------------------------------------------------------------------

interface MemberFit {
  id: string
  name: string
  emoji: string
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({})
    }

    const body = await request.json()
    const mediaIds: string[] = Array.isArray(body?.mediaIds) ? body.mediaIds.slice(0, 50) : []

    if (mediaIds.length === 0) {
      return NextResponse.json({})
    }

    // Fetch family members
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
    })

    if (familyMembers.length === 0) {
      return NextResponse.json({})
    }

    // Fetch all media items with content metrics in one query
    const mediaItems = await prisma.mediaItem.findMany({
      where: { id: { in: mediaIds } },
      include: { contentMetrics: true },
    })

    // Detect if household has any minor (under 18)
    const hasMinor = familyMembers.some((m) => {
      const age = getMemberAge(m.birthYear, m.birthMonth)
      return age != null && age < 18
    })

    // Batch-fetch community warning vote counts
    const warningCounts = await prisma.familyWarningVote.groupBy({
      by: ["mediaId"],
      where: { mediaId: { in: mediaIds } },
      _count: { id: true },
    })
    const warningCountMap = new Map(
      warningCounts.map((w) => [w.mediaId, w._count.id])
    )

    // Build result: { [mediaId]: { members: MemberFit[], familyWarning?: boolean, communityFlagged?: boolean } }
    const result: Record<string, { members: MemberFit[]; familyWarning?: boolean; communityFlagged?: boolean }> = {}

    // Genres/topics that signal concerning content for families
    const CONCERNING_GENRES = new Set(["horreur", "horror", "crime", "thriller", "épouvante"])
    const CONCERNING_TONES = new Set(["Effrayant et angoissant", "Sombre et tendu", "Action intense"])

    for (const media of mediaItems) {
      const metrics = media.contentMetrics ?? {
        violence: 0, sexNudity: 0, language: 0, substanceUse: 0,
        positiveMessages: 3, roleModels: 3,
        toneTags: [] as string[], pacing: null as string | null,
        emotionalThemes: [] as string[],
      }

      // Community-driven warning: enough parent flags to trigger warning
      const communityFlagCount = warningCountMap.get(media.id) || 0
      if (communityFlagCount >= COMMUNITY_WARNING_THRESHOLD) {
        result[media.id] = { members: [], familyWarning: true, communityFlagged: true }
        continue
      }

      // Algorithmic family warning for mature/violent/horror content
      if (hasMinor) {
        const hasConcerningGenre = media.genres.some((g) => CONCERNING_GENRES.has(g.toLowerCase()))
        const hasHighViolence = metrics.violence >= 4 || metrics.sexNudity >= 4
        const hasConcerningTone = ((metrics.toneTags ?? []) as string[]).some((t) => CONCERNING_TONES.has(t))

        if (hasConcerningGenre || hasHighViolence || hasConcerningTone) {
          result[media.id] = { members: [], familyWarning: true }
          continue
        } else if (media.expertAgeRec != null && media.expertAgeRec >= 13 && (metrics.violence >= 3 || metrics.sexNudity >= 3)) {
          result[media.id] = { members: [], familyWarning: true }
          continue
        }
      }

      const fittingMembers: MemberFit[] = []

      for (const member of familyMembers) {
        const memberAge = getMemberAge(member.birthYear, member.birthMonth)
        const hasPreferences = member.useCustomSettings && member.favoriteGenres.length > 0

        const ageScore = computeAgeScore(media.expertAgeRec, memberAge, media.tmdbRating)

        let score: number

        // Mature content penalty applies regardless of quiz completion
        const maturePenaltyMultiplier = computeMatureContentPenalty(
          media.genres,
          { violence: metrics.violence, sexNudity: metrics.sexNudity },
          media.expertAgeRec,
          memberAge
        )

        if (!hasPreferences) {
          // Age-only scoring for members without quiz
          score = Math.round(Math.max(0, Math.min(100, ageScore * maturePenaltyMultiplier * 100)))
        } else {
          const sensitivityScore = computeSensitivityScore(
            { violence: metrics.violence, sexNudity: metrics.sexNudity, language: metrics.language, substanceUse: metrics.substanceUse },
            { sensitivityViolence: member.sensitivityViolence, sensitivitySexual: member.sensitivitySexual, sensitivityLanguage: member.sensitivityLanguage, sensitivitySubstances: member.sensitivitySubstances }
          )
          const genreScore = computeGenreScore(media.genres, member.favoriteGenres, member.dislikedGenres)
          const avoidScore = computeAvoidScore(media.topics, member.avoidTopics)
          const toneScore = computeToneScore(
            (metrics.toneTags ?? []) as string[],
            (metrics.pacing ?? null) as string | null,
            memberAge, member.sensitivityScary
          )
          const interestsScore = computeInterestsScore(
            media.topics,
            (metrics.emotionalThemes ?? []) as string[],
            member.interests
          )
          const positiveScore = computePositiveContentScore(
            { positiveMessages: metrics.positiveMessages, roleModels: metrics.roleModels },
            { preferPositiveMessages: member.preferPositiveMessages, preferRoleModels: member.preferRoleModels, preferEducational: member.preferEducational },
            media.topics
          )

          const rawScore =
            ageScore * 0.30 +
            sensitivityScore * 0.25 +
            genreScore * 0.10 +
            interestsScore * 0.10 +
            0.10 * 0.5 + // affinity neutral (no reaction history in batch mode)
            toneScore * 0.05 +
            positiveScore * 0.05 +
            avoidScore * 0.05

          score = Math.round(Math.max(0, Math.min(100, rawScore * maturePenaltyMultiplier * 100)))
        }

        // Hard age gate: never show a child on content rated 3+ years above their age
        if (media.expertAgeRec != null && memberAge != null && media.expertAgeRec > memberAge + 2) {
          continue
        }

        // Hide adults from young kids' content cards (not relevant to show)
        if (memberAge != null && memberAge >= 16 && media.expertAgeRec != null && media.expertAgeRec < 10) {
          continue
        }

        // Only include members with decent fit (>= 60)
        if (score >= 60) {
          fittingMembers.push({
            id: member.id,
            name: member.name,
            emoji: member.avatarEmoji,
            avatarStyle: member.avatarStyle,
            avatarSeed: member.avatarSeed,
            avatarOptions: member.avatarOptions as Record<string, unknown> | null,
            score,
            level: score >= 75 ? "excellent" : score >= 60 ? "good" : score >= 35 ? "moderate" : "poor",
          })
        }
      }

      // Sort by score descending
      fittingMembers.sort((a, b) => b.score - a.score)

      if (fittingMembers.length > 0) {
        result[media.id] = { members: fittingMembers }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Batch family fit error:", error)
    return NextResponse.json(
      { error: "Erreur lors du calcul" },
      { status: 500 }
    )
  }
}
