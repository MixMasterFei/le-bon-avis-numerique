import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

function computeAgeScore(expertAgeRec: number | null, memberAge: number | null): number {
  if (expertAgeRec == null || memberAge == null) return 0.5
  if (expertAgeRec <= memberAge) return 1.0
  if (expertAgeRec === memberAge + 1) return 0.7
  return 0.2
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
    if (tolerance === 0) continue
    const threshold = 4 - tolerance
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

    // Build result: { [mediaId]: { members: MemberFit[] } }
    const result: Record<string, { members: MemberFit[] }> = {}

    for (const media of mediaItems) {
      const metrics = media.contentMetrics ?? {
        violence: 0, sexNudity: 0, language: 0, substanceUse: 0,
        toneTags: [] as string[], pacing: null as string | null,
      }

      const fittingMembers: MemberFit[] = []

      for (const member of familyMembers) {
        const memberAge = member.birthYear != null ? currentYear - member.birthYear : null
        const hasPreferences = member.useCustomSettings && member.favoriteGenres.length > 0

        const ageScore = computeAgeScore(media.expertAgeRec, memberAge)

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

        // Only include members with decent fit (>= 55)
        if (score >= 55) {
          fittingMembers.push({
            id: member.id,
            name: member.name,
            emoji: member.avatarEmoji,
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
