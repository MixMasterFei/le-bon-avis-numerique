import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"

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

// Studios, brands, and IPs whose content is designed for all ages.
// When a media item's topics match, the age gap penalty is removed entirely.
const FAMILY_VIP_BRANDS = new Set([
  // Animation studios
  "disney", "pixar", "dreamworks", "studio ghibli",
  "aardman", "illumination", "laika",
  // Game brands
  "nintendo", "lego", "minecraft",
  // French/European IPs
  "astérix", "asterix", "tintin",
])

function computeAgeScore(
  expertAgeRec: number | null,
  memberAge: number | null,
  tmdbRating?: number | null,
  genres?: string[],
  topics?: string[]
): number {
  if (expertAgeRec == null || memberAge == null) return 0.5

  // Too young for this content
  if (expertAgeRec > memberAge + 1) return 0.2
  if (expertAgeRec > memberAge) return 0.7

  // Content is at or below viewer's age — penalise large gaps
  // (a 14-year-old watching a 3+ show should score lower than a 10+ show)
  // BUT adults watching mature content (10+) is perfectly normal
  const gap = memberAge - expertAgeRec
  if (gap <= 3) return 1.0

  // Adults (16+) watching content rated 10+ → no penalty
  if (memberAge >= 16 && expertAgeRec >= 10) return 1.0

  // Family VIP brands: content designed for all ages (Nintendo, Pixar, Ghibli, etc.)
  // No age gap penalty at all — parents and teens watching is the intended experience
  const lowerTopics = (topics || []).map(t => t.toLowerCase())
  if (lowerTopics.some(t => FAMILY_VIP_BRANDS.has(t))) return 1.0

  // Family/animation content: very gentle penalty (floor 0.75)
  // Parents and teens watching animated/family content is normal
  const lowerGenres = (genres || []).map(g => g.toLowerCase())
  const isFamilyContent = lowerGenres.some(g =>
    g === "animation" || g === "famille" || g === "familial" || g === "family"
  )
  if (isFamilyContent) {
    const softPenalty = (gap - 3) * 0.03
    return Math.max(0.75, 1.0 - softPenalty)
  }

  // Non-family content: gradual penalty, each year beyond 3 costs 0.10, floor 0.30
  const rawPenalty = (gap - 3) * 0.10
  let score = Math.max(0.30, 1.0 - rawPenalty)

  // Universal-appeal boost for highly-rated content (e.g. well-reviewed dramas)
  const rating = tmdbRating ?? 0
  if (rating >= 7.5) {
    const boost = Math.min(0.25, (rating - 7.5) * 0.15)
    score = Math.min(1.0, score + boost)
  }

  return score
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
    // tolerance=0 means "not configured" — use moderate default (2) instead of skipping
    const effectiveTolerance = tolerance === 0 ? 2 : tolerance

    // Map tolerance to threshold:
    // 3 (strict) -> threshold 1
    // 2 (moderate) -> threshold 2
    // 1 (low tolerance) -> threshold 3
    const threshold = 4 - effectiveTolerance
    const over = Math.max(0, metricValue - threshold)
    const deduction = over * 0.25
    total += Math.max(0, 1 - deduction)
    count++
  }

  return count === 0 ? 1.0 : total / count
}

function computeGenreScore(mediaGenres: string[], favoriteGenres: string[], dislikedGenres: string[] = []): number {
  if (favoriteGenres.length === 0 && dislikedGenres.length === 0) return 0.5

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaGenres.map(normalise))

  // Positive: favorite genre matches
  let score = 0.5
  if (favoriteGenres.length > 0) {
    const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
    const denominator = Math.max(1, Math.min(3, favoriteGenres.length))
    score = Math.min(1.0, matching / denominator)
  }

  // Negative: disliked genre penalty (-0.3 per match)
  if (dislikedGenres.length > 0) {
    const dislikedMatches = dislikedGenres.filter((g) => mediaSet.has(normalise(g))).length
    score = Math.max(0, score - dislikedMatches * 0.3)
  }

  return score
}

function computeInterestsScore(mediaTopics: string[], emotionalThemes: string[], memberInterests: string[]): number {
  if (memberInterests.length === 0) return 0.5

  const normalise = (s: string) => s.toLowerCase().trim()
  // Combine media topics + emotional themes for matching
  const mediaTagSet = new Set([...mediaTopics, ...emotionalThemes].map(normalise))
  const matching = memberInterests.filter((i) => mediaTagSet.has(normalise(i))).length

  if (matching === 0) return 0.3 // slight penalty — no overlap
  // 1 match = 0.6, 2 = 0.8, 3+ = 1.0
  return Math.min(1.0, 0.4 + matching * 0.2)
}

function computePositiveContentScore(
  metrics: { positiveMessages: number; roleModels: number },
  member: { preferPositiveMessages: number; preferRoleModels: number; preferEducational: number },
  mediaTopics: string[]
): number {
  // No strong preferences → neutral
  if (member.preferPositiveMessages <= 1 && member.preferRoleModels <= 1 && member.preferEducational <= 1) return 0.5

  let score = 0.5

  // Positive messages
  if (member.preferPositiveMessages >= 2) {
    if (metrics.positiveMessages >= 4) score += 0.2
    else if (metrics.positiveMessages >= 3) score += 0.1
    else if (member.preferPositiveMessages === 3 && metrics.positiveMessages < 2) score -= 0.15
  }

  // Role models
  if (member.preferRoleModels >= 2) {
    if (metrics.roleModels >= 4) score += 0.2
    else if (metrics.roleModels >= 3) score += 0.1
    else if (member.preferRoleModels === 3 && metrics.roleModels < 2) score -= 0.15
  }

  // Educational preference
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
  if (score >= 60) return "good"
  if (score >= 35) return "moderate"
  return "poor"
}

// Genres that should always flag caution, especially for minors
const MATURE_GENRES = new Set(["horreur", "horror", "épouvante", "thriller", "crime"])

/**
 * Compute a penalty for mature/violent/horror content.
 * This applies regardless of quiz completion, based on genres + content metrics.
 * Returns a multiplier: 1.0 = no penalty, 0.0 = maximum penalty.
 */
function computeMatureContentPenalty(
  mediaGenres: string[],
  metrics: { violence: number; sexNudity: number },
  expertAgeRec: number | null,
  memberAge: number | null
): { multiplier: number; reason: string | null } {
  const hasMatureGenre = mediaGenres.some((g) => MATURE_GENRES.has(g.toLowerCase()))
  const hasHighViolence = metrics.violence >= 4
  const hasHighSexual = metrics.sexNudity >= 4
  const isMatureContent = hasMatureGenre || hasHighViolence || hasHighSexual

  if (!isMatureContent) return { multiplier: 1.0, reason: null }

  const isMinor = memberAge != null && memberAge < 18
  const isChild = memberAge != null && memberAge < 13

  // Children under 13: strong penalty on horror/violent content
  if (isChild) {
    return { multiplier: 0.25, reason: "contenu mature inadapté aux enfants" }
  }

  // Teens 13-17: moderate penalty — these need parental attention
  // 0.45 for age-appropriate gives score 45 → "moderate" (not misleading "good")
  if (isMinor) {
    const isAgeAppropriate = expertAgeRec != null && memberAge != null && memberAge >= expertAgeRec
    if (isAgeAppropriate) {
      return { multiplier: 0.45, reason: "contenu mature, vigilance conseillée" }
    }
    return { multiplier: 0.25, reason: "contenu mature inadapté à son âge" }
  }

  // Adults: no score penalty, but add informational reason
  return { multiplier: 1.0, reason: hasMatureGenre ? "contenu mature" : null }
}

function buildReason(
  ageScore: number,
  sensitivityScore: number,
  genreScore: number,
  avoidScore: number,
  toneScore: number,
  interestsScore: number,
  positiveScore: number,
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
  } else if (ageScore <= 0.3 && memberAge != null && expertAgeRec != null && expertAgeRec > memberAge) {
    parts.push(`recommandé à partir de ${expertAgeRec} ans`)
  } else if (ageScore <= 0.5 && memberAge != null && expertAgeRec != null && memberAge > expertAgeRec) {
    parts.push("peut sembler un peu jeune pour son âge")
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

  // Genre match / dislike
  if (genreScore >= 0.7) {
    parts.push("correspond à ses genres préférés")
  } else if (genreScore <= 0.2) {
    parts.push("genre non apprécié")
  }

  // Interests match
  if (interestsScore >= 0.8) {
    parts.push("correspond à ses centres d'intérêt")
  }

  // Positive content
  if (positiveScore >= 0.8) {
    parts.push("contenu éducatif/positif apprécié")
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



    // Detect if household has any minor (under 18)
    const hasMinor = familyMembers.some((m) => {
      const age = getMemberAge(m.birthYear, m.birthMonth)
      return age != null && age < 18
    })

    const metrics = media.contentMetrics ?? {
      violence: 0,
      sexNudity: 0,
      language: 0,
      substanceUse: 0,
      positiveMessages: 3,
      roleModels: 3,
      toneTags: [] as string[],
      pacing: null as string | null,
      emotionalThemes: [] as string[],
    }

    // Family warning for mature/violent/horror content when household has minors
    const CONCERNING_GENRES = new Set(["horreur", "horror", "crime", "thriller", "épouvante"])
    const CONCERNING_TONES = new Set(["Effrayant et angoissant", "Sombre et tendu", "Action intense"])
    let isFamilyWarning = false

    if (hasMinor) {
      const hasConcerningGenre = media.genres.some((g) => CONCERNING_GENRES.has(g.toLowerCase()))
      const hasHighViolence = metrics.violence >= 4 || metrics.sexNudity >= 4
      const hasConcerningTone = ((metrics.toneTags ?? []) as string[]).some((t) => CONCERNING_TONES.has(t))

      // Trigger warning for any horror/violent content (regardless of age rating)
      // or for 13+ content with high violence/sexual metrics
      if (hasConcerningGenre || hasHighViolence || hasConcerningTone) {
        isFamilyWarning = true
      } else if (media.expertAgeRec != null && media.expertAgeRec >= 13 && (metrics.violence >= 3 || metrics.sexNudity >= 3)) {
        isFamilyWarning = true
      }
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
      const memberAge = getMemberAge(member.birthYear, member.birthMonth)
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
      const ageScore = computeAgeScore(media.expertAgeRec, memberAge, media.tmdbRating, media.genres, media.topics)

      // When quiz is NOT done, only use age score — don't inflate with defaults
      // But still apply mature content penalty for horror/violent content
      if (!hasPreferences) {
        const maturePenalty = computeMatureContentPenalty(
          media.genres,
          { violence: metrics.violence, sexNudity: metrics.sexNudity },
          media.expertAgeRec,
          memberAge
        )

        const penalizedScore = ageScore * maturePenalty.multiplier
        const ageOnlyScore = Math.round(Math.max(0, Math.min(100, penalizedScore * 100)))
        // Cap at "good" — never show "Excellent" without real preferences
        const level = ageOnlyScore >= 60 ? "good" as const : levelFromScore(ageOnlyScore)

        let reason: string
        if (maturePenalty.reason && maturePenalty.multiplier < 1.0) {
          // Mature content penalty takes priority in the reason
          reason = maturePenalty.reason.charAt(0).toUpperCase() + maturePenalty.reason.slice(1)
        } else if (ageScore >= 0.9) {
          reason = "Adapté à son âge"
        } else if (ageScore <= 0.3 && memberAge != null && media.expertAgeRec != null && media.expertAgeRec > memberAge) {
          reason = `Recommandé à partir de ${media.expertAgeRec} ans`
        } else if (ageScore <= 0.5 && memberAge != null && media.expertAgeRec != null && memberAge > media.expertAgeRec) {
          reason = "Peut sembler un peu jeune pour son âge"
        } else {
          reason = "Basé uniquement sur l'âge"
        }

        // For adults: add mature content info even without score penalty
        if (maturePenalty.reason && maturePenalty.multiplier >= 1.0) {
          reason = reason + ", " + maturePenalty.reason
        }

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
      const genreScore = computeGenreScore(media.genres, member.favoriteGenres, member.dislikedGenres)
      const avoidScore = computeAvoidScore(media.topics, member.avoidTopics)
      const toneScore = computeToneScore(
        (metrics.toneTags ?? []) as string[],
        (metrics.pacing ?? null) as string | null,
        memberAge,
        member.sensitivityScary
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

      // Weighted total (30/25/10/10/10/5/5/5 = 100%)
      const rawScore =
        ageScore * 0.30 +
        sensitivityScore * 0.25 +
        genreScore * 0.10 +
        interestsScore * 0.10 +
        affinityScore * 0.10 +
        toneScore * 0.05 +
        positiveScore * 0.05 +
        avoidScore * 0.05

      // Apply mature content penalty for horror/violent content
      const maturePenalty = computeMatureContentPenalty(
        media.genres,
        { violence: metrics.violence, sexNudity: metrics.sexNudity },
        media.expertAgeRec,
        memberAge
      )
      const penalizedRawScore = rawScore * maturePenalty.multiplier

      const score = Math.round(Math.max(0, Math.min(100, penalizedRawScore * 100)))
      const level = levelFromScore(score)
      let reason = buildReason(
        ageScore,
        sensitivityScore,
        genreScore,
        avoidScore,
        toneScore,
        interestsScore,
        positiveScore,
        memberAge,
        media.expertAgeRec,
        (metrics.toneTags ?? []) as string[]
      )

      // Override reason if mature content penalty is the dominant factor
      if (maturePenalty.reason && maturePenalty.multiplier < 1.0) {
        reason = maturePenalty.reason.charAt(0).toUpperCase() + maturePenalty.reason.slice(1)
      } else if (maturePenalty.reason && maturePenalty.multiplier >= 1.0) {
        // Adults: append mature content info
        reason = reason + ", " + maturePenalty.reason
      }

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

    return NextResponse.json(
      { status: isFamilyWarning ? "family_warning" : "ok", members },
      { headers: { "Cache-Control": "private, max-age=60" } }
    )
  } catch (error) {
    console.error("Family fit error:", error)
    return NextResponse.json(
      { error: "Erreur lors du calcul de compatibilité" },
      { status: 500 }
    )
  }
}
