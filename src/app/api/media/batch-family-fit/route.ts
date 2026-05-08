import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { COMMUNITY_WARNING_THRESHOLD } from "@/lib/family-warning"
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
  DEFAULT_FIT_METRICS,
  hasRichProfile,
  isFamilyWarningContent,
  type FitLevel,
} from "@/lib/family-fit-score"

// ---------------------------------------------------------------------------
// Batch Family Fit API
// Computes fit scores for multiple media items × all family members at once.
// Used by the homepage to show member avatars on cards in a single request.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

interface MemberFit {
  id: string
  name: string
  emoji: string
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
  score: number
  level: FitLevel
  reason?: string
  hasPreferences?: boolean
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

    for (const media of mediaItems) {
      const metrics = media.contentMetrics ?? DEFAULT_FIT_METRICS

      // Community-driven warning: enough parent flags to trigger warning
      const communityFlagCount = warningCountMap.get(media.id) || 0
      if (communityFlagCount >= COMMUNITY_WARNING_THRESHOLD) {
        result[media.id] = { members: [], familyWarning: true, communityFlagged: true }
        continue
      }

      // Algorithmic family warning for mature/violent/horror content
      if (hasMinor) {
        if (isFamilyWarningContent(
          media.genres,
          { violence: metrics.violence, sexNudity: metrics.sexNudity, toneTags: (metrics.toneTags ?? []) as string[] },
          media.expertAgeRec,
        )) {
          result[media.id] = { members: [], familyWarning: true }
          continue
        }
      }

      const fittingMembers: MemberFit[] = []

      for (const member of familyMembers) {
        const memberAge = getMemberAge(member.birthYear, member.birthMonth)
        const hasPreferences = hasRichProfile(member)

        const ageScore = computeAgeScore(media.expertAgeRec, memberAge, media.tmdbRating, media.genres, media.topics)

        // Mature content penalty applies regardless of quiz completion
        const maturePenalty = computeMatureContentPenalty(
          media.genres,
          { violence: metrics.violence, sexNudity: metrics.sexNudity },
          media.expertAgeRec,
          memberAge
        )

        let rawScore: number
        if (!hasPreferences) {
          // Age-only scoring for members without quiz
          rawScore = clampScore(ageScore * maturePenalty.multiplier * 100)
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

          rawScore = clampScore(
            computeWeightedFitScore({
              ageScore,
              sensitivityScore,
              genreScore,
              interestsScore,
              affinityScore: 0.5,
              toneScore,
              positiveScore,
              avoidScore,
            }) * maturePenalty.multiplier
          )
        }

        const guarded = applyFitGuardrails({
          score: rawScore,
          memberAge,
          expertAgeRec: media.expertAgeRec,
          hasRichProfile: hasPreferences,
        })

        // Hard age gate: never show a child on content rated 2+ years above their age
        if (media.expertAgeRec != null && memberAge != null && media.expertAgeRec >= memberAge + 2) {
          continue
        }

        // Adults always shown — universal-appeal content (Nintendo, Ghibli, etc.) is relevant to parents

        // Only include members with decent fit (>= 60)
        if (guarded.score >= 60 && !guarded.ageWarning) {
          fittingMembers.push({
            id: member.id,
            name: member.name,
            emoji: member.avatarEmoji,
            avatarStyle: member.avatarStyle,
            avatarSeed: member.avatarSeed,
            avatarOptions: member.avatarOptions as Record<string, unknown> | null,
            score: guarded.score,
            level: guarded.level,
            reason: guarded.reasonOverride ?? maturePenalty.reason ?? undefined,
            hasPreferences,
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
