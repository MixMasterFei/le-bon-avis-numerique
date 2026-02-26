import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Family Fit API
// Returns how well a media item fits each family member (score 0-100)
// ---------------------------------------------------------------------------

interface FamilyFitMember {
  id: string
  name: string
  avatarEmoji: string
  age: number | null
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
  reason: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAgeScore(expertAgeRec: number | null, memberAge: number | null): number {
  if (expertAgeRec == null || memberAge == null) return 0.5

  if (expertAgeRec <= memberAge) return 1.0
  if (expertAgeRec === memberAge + 1) return 0.7
  return 0.2
}

function computeSensitivityScore(
  metrics: { violence: number; sexNudity: number; language: number; substanceUse: number },
  member: {
    sensitivityViolence: number
    sensitivitySexual: number
    sensitivityLanguage: number
    sensitivitySubstances: number
  }
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
    // 0 = don't care -> skip
    if (tolerance === 0) continue

    // Map tolerance to threshold:
    // 3 (strict) -> threshold 1
    // 2 (moderate) -> threshold 2
    // 1 (low tolerance) -> threshold 3
    const threshold = 4 - tolerance
    const over = Math.max(0, metricValue - threshold)
    const deduction = over * 0.25
    total += Math.max(0, 1 - deduction)
    count++
  }

  return count === 0 ? 1.0 : total / count
}

function computeGenreScore(mediaGenres: string[], favoriteGenres: string[]): number {
  if (favoriteGenres.length === 0) return 0.5

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaGenres.map(normalise))
  const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
  const denominator = Math.max(1, Math.min(3, favoriteGenres.length))

  return Math.min(1.0, matching / denominator)
}

function computeAvoidScore(mediaTopics: string[], avoidTopics: string[]): number {
  if (avoidTopics.length === 0) return 1.0

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaTopics.map(normalise))
  const hasMatch = avoidTopics.some((t) => mediaSet.has(normalise(t)))

  return hasMatch ? 0 : 1.0
}

function levelFromScore(score: number): "excellent" | "good" | "moderate" | "poor" {
  if (score >= 75) return "excellent"
  if (score >= 55) return "good"
  if (score >= 35) return "moderate"
  return "poor"
}

function buildReason(
  ageScore: number,
  sensitivityScore: number,
  genreScore: number,
  avoidScore: number,
  memberAge: number | null,
  expertAgeRec: number | null
): string {
  const parts: string[] = []

  // Avoided topic is the most critical flag
  if (avoidScore === 0) {
    parts.push("contient des sujets que vous souhaitez éviter")
  }

  // Age appropriateness
  if (ageScore >= 0.9) {
    parts.push("adapté à son âge")
  } else if (ageScore <= 0.3 && memberAge != null && expertAgeRec != null) {
    parts.push(`recommandé à partir de ${expertAgeRec} ans`)
  }

  // Sensitivity
  if (sensitivityScore < 0.5) {
    parts.push("contenu sensible pour son profil")
  }

  // Genre match
  if (genreScore >= 0.7) {
    parts.push("correspond à ses genres préférés")
  }

  if (parts.length === 0) {
    // Fallback
    if (ageScore >= 0.7 && sensitivityScore >= 0.7) {
      return "Globalement adapté à son profil"
    }
    return "Quelques points à vérifier"
  }

  // Capitalise first letter and join
  const sentence = parts.join(", ")
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ status: "not_logged_in" })
    }

    const { id } = await params

    // Fetch family members for the authenticated user
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
    })

    if (familyMembers.length === 0) {
      return NextResponse.json({ status: "no_family" })
    }

    // Fetch media item with content metrics
    const media = await prisma.mediaItem.findUnique({
      where: { id },
      include: { contentMetrics: true },
    })

    if (!media) {
      return NextResponse.json(
        { error: "Media introuvable" },
        { status: 404 }
      )
    }

    const currentYear = new Date().getFullYear()

    const metrics = media.contentMetrics ?? {
      violence: 0,
      sexNudity: 0,
      language: 0,
      substanceUse: 0,
    }

    const members: FamilyFitMember[] = familyMembers.map((member) => {
      const memberAge = member.birthYear != null ? currentYear - member.birthYear : null

      // --- Weighted score components ---
      const ageScore = computeAgeScore(media.expertAgeRec, memberAge)
      const sensitivityScore = computeSensitivityScore(
        {
          violence: metrics.violence,
          sexNudity: metrics.sexNudity,
          language: metrics.language,
          substanceUse: metrics.substanceUse,
        },
        {
          sensitivityViolence: member.sensitivityViolence,
          sensitivitySexual: member.sensitivitySexual,
          sensitivityLanguage: member.sensitivityLanguage,
          sensitivitySubstances: member.sensitivitySubstances,
        }
      )
      const genreScore = computeGenreScore(media.genres, member.favoriteGenres)
      const avoidScore = computeAvoidScore(media.topics, member.avoidTopics)

      // Weighted total (percentages as described)
      const rawScore =
        ageScore * 0.4 +
        sensitivityScore * 0.35 +
        genreScore * 0.15 +
        avoidScore * 0.1

      const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))
      const level = levelFromScore(score)
      const reason = buildReason(
        ageScore,
        sensitivityScore,
        genreScore,
        avoidScore,
        memberAge,
        media.expertAgeRec
      )

      return {
        id: member.id,
        name: member.name,
        avatarEmoji: member.avatarEmoji,
        age: memberAge,
        score,
        level,
        reason,
      }
    })

    return NextResponse.json({ status: "ok", members })
  } catch (error) {
    console.error("Family fit error:", error)
    return NextResponse.json(
      { error: "Erreur lors du calcul de compatibilité" },
      { status: 500 }
    )
  }
}
