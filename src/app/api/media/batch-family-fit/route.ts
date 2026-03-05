import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { COMMUNITY_WARNING_THRESHOLD } from "@/lib/family-warning"

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
  const gap = memberAge - expertAgeRec
  if (gap <= 3) return 1.0

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

function computeGenreScore(mediaGenres: string[], favoriteGenres: string[]): number {
  if (favoriteGenres.length === 0) return 0.5
  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaGenres.map(normalise))
  const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
  return Math.min(1.0, matching / Math.max(1, Math.min(3, favoriteGenres.length)))
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

    const currentYear = new Date().getFullYear()

    // Detect if household has any minor (under 18)
    const hasMinor = familyMembers.some((m) => {
      if (m.birthYear == null) return false
      return currentYear - m.birthYear < 18
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
        toneTags: [] as string[], pacing: null as string | null,
      }

      // Community-driven warning: enough parent flags to trigger warning
      const communityFlagCount = warningCountMap.get(media.id) || 0
      if (communityFlagCount >= COMMUNITY_WARNING_THRESHOLD) {
        result[media.id] = { members: [], familyWarning: true, communityFlagged: true }
        continue
      }

      // Algorithmic family warning for 15+ content that's genuinely concerning
      if (hasMinor && media.expertAgeRec != null && media.expertAgeRec >= 15) {
        const hasConcerningGenre = media.genres.some((g) => CONCERNING_GENRES.has(g.toLowerCase()))
        const hasHighViolence = metrics.violence >= 4 || metrics.sexNudity >= 4
        const hasConcerningTone = ((metrics.toneTags ?? []) as string[]).some((t) => CONCERNING_TONES.has(t))

        if (hasConcerningGenre || hasHighViolence || hasConcerningTone) {
          result[media.id] = { members: [], familyWarning: true }
          continue
        }
      }

      const fittingMembers: MemberFit[] = []

      for (const member of familyMembers) {
        const memberAge = member.birthYear != null ? currentYear - member.birthYear : null
        const hasPreferences = member.useCustomSettings && member.favoriteGenres.length > 0

        const ageScore = computeAgeScore(media.expertAgeRec, memberAge, media.tmdbRating)

        let score: number

        if (!hasPreferences) {
          // Age-only scoring for members without quiz
          score = Math.round(Math.max(0, Math.min(100, ageScore * 100)))
        } else {
          const sensitivityScore = computeSensitivityScore(
            { violence: metrics.violence, sexNudity: metrics.sexNudity, language: metrics.language, substanceUse: metrics.substanceUse },
            { sensitivityViolence: member.sensitivityViolence, sensitivitySexual: member.sensitivitySexual, sensitivityLanguage: member.sensitivityLanguage, sensitivitySubstances: member.sensitivitySubstances }
          )
          const genreScore = computeGenreScore(media.genres, member.favoriteGenres)
          const avoidScore = computeAvoidScore(media.topics, member.avoidTopics)
          const toneScore = computeToneScore(
            (metrics.toneTags ?? []) as string[],
            (metrics.pacing ?? null) as string | null,
            memberAge, member.sensitivityScary
          )

          const rawScore =
            ageScore * 0.35 +
            sensitivityScore * 0.30 +
            genreScore * 0.10 +
            avoidScore * 0.05 +
            0.10 * 0.5 + // affinity neutral (no reaction history in batch mode)
            toneScore * 0.10

          score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))
        }

        // Hard age gate: never show a child on content rated 3+ years above their age
        if (media.expertAgeRec != null && memberAge != null && media.expertAgeRec > memberAge + 2) {
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
            level: score >= 75 ? "excellent" : score >= 55 ? "good" : score >= 35 ? "moderate" : "poor",
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
