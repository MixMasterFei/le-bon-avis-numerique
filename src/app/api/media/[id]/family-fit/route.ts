import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Family Fit API
// Returns how well a media item fits each family member (score 0-100)
// ---------------------------------------------------------------------------

interface AffinityInfo {
  hasConnection: boolean
  connectedMedia?: { title: string; reaction: string }
  affinityReason?: string
  genreAffinityScore?: number
}

interface FamilyFitMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
  age: number | null
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
  reason: string
  hasPreferences: boolean
  affinity: AffinityInfo
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAgeScore(expertAgeRec: number | null, memberAge: number | null): number {
  if (expertAgeRec == null || memberAge == null) return 0.5

  // Too young for this content
  if (expertAgeRec > memberAge) {
    if (expertAgeRec === memberAge + 1) return 0.7
    return 0.2
  }

  // Age appropriate — decay when much older than target audience
  const overshoot = memberAge - expertAgeRec
  if (overshoot <= 2) return 1.0
  if (overshoot <= 5) return 0.85
  if (overshoot <= 10) return 0.7
  return 0.5
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

// Tone tags that feel gentle/safe for young children
const GENTLE_TONES = new Set([
  "Doux et chaleureux",
  "Doux et rassurant",
  "Joyeux et coloré",
  "Drôle et léger",
  "Inspiré et motivant",
])

// Tone tags that are dark/scary — penalised for young or sensitive children
const DARK_TONES = new Set([
  "Sombre et tendu",
  "Effrayant et angoissant",
  "Action intense",
])

function computeToneScore(
  toneTags: string[],
  pacing: string | null,
  memberAge: number | null,
  sensitivityScary: number
): number {
  // No tone data → neutral (no impact)
  if (toneTags.length === 0 && !pacing) return 0.5

  let score = 0.5 // start neutral

  // --- Tone tag scoring ---
  const hasGentle = toneTags.some((t) => GENTLE_TONES.has(t))
  const hasDark = toneTags.some((t) => DARK_TONES.has(t))

  if (memberAge !== null && memberAge < 7) {
    // Young children: strong bonus for gentle, strong penalty for dark
    if (hasGentle) score += 0.3
    if (hasDark) score -= 0.4
  } else if (memberAge !== null && memberAge < 13) {
    // Children 7-12: mild bonus for gentle, penalty for scary only if high sensitivity
    if (hasGentle) score += 0.15
    if (hasDark && sensitivityScary >= 2) score -= 0.3
    else if (hasDark) score -= 0.1
  } else {
    // Teens/adults: minimal adjustment
    if (hasGentle) score += 0.05
    if (hasDark && sensitivityScary >= 3) score -= 0.15
  }

  // --- Pacing scoring (affects very young children) ---
  if (pacing && memberAge !== null && memberAge < 5) {
    if (pacing === "Rapide et frénétique") score -= 0.2
    else if (pacing === "Dynamique") score -= 0.05
    else if (pacing === "Très calme" || pacing === "Lent et contemplatif") score += 0.1
  }

  return Math.max(0, Math.min(1, score))
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
  toneScore: number,
  memberAge: number | null,
  expertAgeRec: number | null,
  toneTags: string[]
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
  } else if (ageScore <= 0.7 && memberAge != null && expertAgeRec != null && memberAge > expertAgeRec) {
    parts.push("adapté à son âge")
  }

  // Sensitivity
  if (sensitivityScore < 0.5) {
    parts.push("contenu sensible pour son profil")
  }

  // Tone-based reasons
  if (toneScore >= 0.8 && toneTags.length > 0) {
    const hasGentle = toneTags.some((t) => GENTLE_TONES.has(t))
    if (hasGentle) {
      parts.push("ambiance douce adaptée à son âge")
    }
  } else if (toneScore < 0.3 && toneTags.length > 0) {
    const hasDark = toneTags.some((t) => DARK_TONES.has(t))
    if (hasDark) {
      parts.push("ambiance sombre ou intense")
    }
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
      toneTags: [] as string[],
      pacing: null as string | null,
    }

    // Fetch positive reactions for all family members (for affinity scoring)
    const positiveReactions = await prisma.mediaReaction.findMany({
      where: {
        familyMemberId: { in: familyMembers.map(m => m.id) },
        reaction: { in: ["LOVED", "LIKED"] },
      },
      include: {
        media: {
          select: { id: true, title: true, genres: true },
        },
      },
    })

    // Fetch pre-computed similarities for this media
    const similarities = await prisma.mediaSimilarity.findMany({
      where: {
        OR: [
          { mediaIdA: id },
          { mediaIdB: id },
        ],
        similarityScore: { gte: 0.4 },
      },
      orderBy: { similarityScore: "desc" },
      take: 50,
    })

    // Build a map of similar media IDs -> similarity info
    const similarMediaMap = new Map<string, { score: number; reasons: string[] }>()
    for (const sim of similarities) {
      const otherId = sim.mediaIdA === id ? sim.mediaIdB : sim.mediaIdA
      similarMediaMap.set(otherId, { score: sim.similarityScore, reasons: sim.reasons })
    }

    const members: FamilyFitMember[] = familyMembers.map((member) => {
      const memberAge = member.birthYear != null ? currentYear - member.birthYear : null
      const hasPreferences = member.useCustomSettings && member.favoriteGenres.length > 0

      // --- Compute affinity from watch history ---
      const memberReactions = positiveReactions.filter(r => r.familyMemberId === member.id)
      let affinity: AffinityInfo = { hasConnection: false }

      // Check for direct connections via MediaSimilarity
      let bestConnection: { title: string; reaction: string; score: number } | null = null
      for (const reaction of memberReactions) {
        const simInfo = similarMediaMap.get(reaction.mediaId)
        if (simInfo && simInfo.score > (bestConnection?.score ?? 0)) {
          bestConnection = {
            title: reaction.media.title,
            reaction: reaction.reaction,
            score: simInfo.score,
          }
        }
      }

      if (bestConnection) {
        const reactionLabel = bestConnection.reaction === "LOVED" ? "adoré" : "bien aimé"
        affinity = {
          hasConnection: true,
          connectedMedia: {
            title: bestConnection.title,
            reaction: bestConnection.reaction,
          },
          affinityReason: `A ${reactionLabel} ${bestConnection.title}`,
        }
      } else if (memberReactions.length > 0) {
        // No direct similarity, but check genre affinity from reaction history
        const reactionGenres = new Map<string, number>()
        for (const r of memberReactions) {
          const weight = r.reaction === "LOVED" ? 2 : 1
          for (const g of r.media.genres) {
            reactionGenres.set(g.toLowerCase(), (reactionGenres.get(g.toLowerCase()) || 0) + weight)
          }
        }
        // Count how many of the current media's genres match reaction history
        const matchingGenres = media.genres.filter(g => reactionGenres.has(g.toLowerCase()))
        if (matchingGenres.length >= 2 || (matchingGenres.length >= 1 && media.genres.length <= 2)) {
          affinity = {
            hasConnection: false,
            genreAffinityScore: Math.min(100, Math.round((matchingGenres.length / Math.max(2, media.genres.length)) * 100)),
            affinityReason: `Correspond à ses goûts (${matchingGenres.slice(0, 3).join(", ")})`,
          }
        }
      }

      const affinityScore = affinity.hasConnection ? 1.0 : (affinity.genreAffinityScore ? affinity.genreAffinityScore / 100 * 0.5 : 0)

      // --- Weighted score components ---
      const ageScore = computeAgeScore(media.expertAgeRec, memberAge)

      // When quiz is NOT done, only use age score — don't inflate with defaults
      if (!hasPreferences) {
        const ageOnlyScore = Math.round(Math.max(0, Math.min(100, ageScore * 100)))
        // Cap at "good" — never show "Excellent" without real preferences
        const level = ageOnlyScore >= 55 ? "good" as const : levelFromScore(ageOnlyScore)
        const reason = ageScore >= 0.9
          ? "Adapté à son âge"
          : ageScore <= 0.3 && memberAge != null && media.expertAgeRec != null
            ? `Recommandé à partir de ${media.expertAgeRec} ans`
            : "Basé uniquement sur l'âge"

        return {
          id: member.id,
          name: member.name,
          avatarEmoji: member.avatarEmoji,
          avatarStyle: member.avatarStyle,
          avatarSeed: member.avatarSeed,
          avatarOptions: member.avatarOptions as Record<string, unknown> | null,
          age: memberAge,
          score: ageOnlyScore,
          level,
          reason,
          hasPreferences,
          affinity,
        }
      }

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
      const toneScore = computeToneScore(
        (metrics.toneTags ?? []) as string[],
        (metrics.pacing ?? null) as string | null,
        memberAge,
        member.sensitivityScary
      )

      // Weighted total with tone (35/30/10/5/10/10)
      const rawScore =
        ageScore * 0.35 +
        sensitivityScore * 0.30 +
        genreScore * 0.10 +
        avoidScore * 0.05 +
        affinityScore * 0.10 +
        toneScore * 0.10

      const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))
      const level = levelFromScore(score)
      const reason = buildReason(
        ageScore,
        sensitivityScore,
        genreScore,
        avoidScore,
        toneScore,
        memberAge,
        media.expertAgeRec,
        (metrics.toneTags ?? []) as string[]
      )

      return {
        id: member.id,
        name: member.name,
        avatarEmoji: member.avatarEmoji,
        avatarStyle: member.avatarStyle,
        avatarSeed: member.avatarSeed,
        avatarOptions: member.avatarOptions as Record<string, unknown> | null,
        age: memberAge,
        score,
        level,
        reason,
        hasPreferences,
        affinity,
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
