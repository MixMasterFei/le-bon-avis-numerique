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
  DARK_TONES,
  DEFAULT_FIT_METRICS,
  GENTLE_TONES,
  hasRichProfile,
  isFamilyWarningContent,
  type FitLevel,
} from "@/lib/family-fit-score"

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
  level: FitLevel
  reason: string
  hasPreferences: boolean
  affinity: AffinityInfo
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

    const metrics = media.contentMetrics ?? DEFAULT_FIT_METRICS

    // Family warning for mature/violent/horror content when household has minors
    let isFamilyWarning = false

    if (hasMinor) {
      isFamilyWarning = isFamilyWarningContent(
        media.genres,
        { violence: metrics.violence, sexNudity: metrics.sexNudity, toneTags: (metrics.toneTags ?? []) as string[] },
        media.expertAgeRec,
      )
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
      const hasPreferences = hasRichProfile(member)

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

        const guardrails = applyFitGuardrails({
          score: clampScore(ageScore * maturePenalty.multiplier * 100),
          memberAge,
          expertAgeRec: media.expertAgeRec,
          hasRichProfile: false,
        })

        let reason: string
        if (guardrails.reasonOverride) {
          reason = guardrails.reasonOverride
        } else if (maturePenalty.reason && maturePenalty.multiplier < 1.0) {
          // Mature content penalty takes priority in the reason
          reason = maturePenalty.reason.charAt(0).toUpperCase() + maturePenalty.reason.slice(1)
        } else if (ageScore >= 0.9) {
          reason = "Adapté à son âge"
        } else if (ageScore <= 0.3 && memberAge != null && media.expertAgeRec != null && media.expertAgeRec > memberAge) {
          reason = `Recommandé à partir de ${media.expertAgeRec} ans`
        } else if (ageScore <= 0.5 && memberAge != null && media.expertAgeRec != null && memberAge > media.expertAgeRec) {
          reason = "Peut sembler un peu jeune pour son âge"
        } else {
          reason = "Âge"
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
          score: guardrails.score,
          level: guardrails.level,
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

      // Apply mature content penalty for horror/violent content
      const maturePenalty = computeMatureContentPenalty(
        media.genres,
        { violence: metrics.violence, sexNudity: metrics.sexNudity },
        media.expertAgeRec,
        memberAge
      )
      const score = clampScore(
        computeWeightedFitScore({
          ageScore,
          sensitivityScore,
          genreScore,
          interestsScore,
          affinityScore,
          toneScore,
          positiveScore,
          avoidScore,
        }) * maturePenalty.multiplier
      )
      const guardrails = applyFitGuardrails({
        score,
        memberAge,
        expertAgeRec: media.expertAgeRec,
        hasRichProfile: hasPreferences,
      })
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
      if (guardrails.reasonOverride) {
        reason = guardrails.reasonOverride
      } else if (maturePenalty.reason && maturePenalty.multiplier < 1.0) {
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
        score: guardrails.score,
        level: guardrails.level,
        reason,
        hasPreferences,
        affinity,
      }
    })

    return NextResponse.json(
      { status: isFamilyWarning ? "family_warning" : "ok", members },
      {
        headers: {
          // Family composition rarely changes minute-to-minute. Bump the
          // cache so repeat visits during a session hit the browser cache
          // instead of recomputing the full fit pipeline. `private` keeps
          // it per-user (different households never share a cache entry).
          // `stale-while-revalidate` lets us serve instantly while
          // refreshing in the background.
          "Cache-Control":
            "private, max-age=300, stale-while-revalidate=600",
        },
      }
    )
  } catch (error) {
    console.error("Family fit error:", error)
    return NextResponse.json(
      { error: "Erreur lors du calcul de compatibilité" },
      { status: 500 }
    )
  }
}
