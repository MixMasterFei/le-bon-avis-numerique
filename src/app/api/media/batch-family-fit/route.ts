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
  hasYouthAppealSignal,
  isAdultLeaningContentForMinor,
  isFamilyWarningContent,
  type FitLevel,
} from "@/lib/family-fit-score"
import {
  ageVerdictFromAges,
  legacyLevelFromPillars,
  PREFERENCE_PILLAR_LABELS,
  type AgeVerdict,
  type PreferenceVerdict,
  type PreferencePillar,
} from "@/lib/family-fit-display"
import {
  personalizedScore as computePersonalizedScore,
  effectiveSensitivityVector,
  EMPTY_VECTOR,
  type MemberVector,
} from "@/lib/preference-vector"

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
  // legacy single-score fields (derived from pillars)
  score: number
  level: FitLevel
  reason?: string
  // two-axis pillars (Phase 0.2)
  ageVerdict: AgeVerdict
  preferenceVerdict: PreferenceVerdict
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

        // Phase 2: persisted behavioral vector (cold-start = neutral).
        const memberVector = (member.memberVector as unknown as MemberVector | null) ?? EMPTY_VECTOR
        const effSens = effectiveSensitivityVector(
          {
            violence: member.sensitivityViolence,
            sexual: member.sensitivitySexual,
            language: member.sensitivityLanguage,
            substances: member.sensitivitySubstances,
          },
          memberVector.observedTolerances,
        )

        const ageScore = computeAgeScore(media.expertAgeRec, memberAge, media.tmdbRating, media.genres, media.topics)

        // Mature content penalty applies regardless of quiz completion. Reads
        // the effective sensitivity so a member who LOVED several violent
        // titles stops getting flagged when their behavior already confirmed
        // their tolerance.
        const maturePenalty = computeMatureContentPenalty(
          media.genres,
          { violence: metrics.violence, sexNudity: metrics.sexNudity },
          media.expertAgeRec,
          memberAge,
          {
            violence: effSens.violence,
            sexual: effSens.sexual,
          },
        )

        let rawScore: number
        let genreScore: number | undefined
        let interestsScore: number | undefined
        let positiveScore: number | undefined
        if (!hasPreferences) {
          // Age-only scoring for members without quiz
          rawScore = clampScore(ageScore * maturePenalty.multiplier * 100)
        } else {
          const sensitivityScore = computeSensitivityScore(
            { violence: metrics.violence, sexNudity: metrics.sexNudity, language: metrics.language, substanceUse: metrics.substanceUse },
            { sensitivityViolence: member.sensitivityViolence, sensitivitySexual: member.sensitivitySexual, sensitivityLanguage: member.sensitivityLanguage, sensitivitySubstances: member.sensitivitySubstances }
          )
          genreScore = computeGenreScore(media.genres, member.favoriteGenres, member.dislikedGenres)
          const avoidScore = computeAvoidScore(media.topics, member.avoidTopics)
          const toneScore = computeToneScore(
            (metrics.toneTags ?? []) as string[],
            (metrics.pacing ?? null) as string | null,
            memberAge, member.sensitivityScary
          )
          interestsScore = computeInterestsScore(
            media.topics,
            (metrics.emotionalThemes ?? []) as string[],
            member.interests
          )
          positiveScore = computePositiveContentScore(
            { positiveMessages: metrics.positiveMessages, roleModels: metrics.roleModels },
            { preferPositiveMessages: member.preferPositiveMessages, preferRoleModels: member.preferRoleModels, preferEducational: member.preferEducational },
            media.topics
          )

          const personalized = computePersonalizedScore(memberVector, {
            genres: media.genres,
            topics: media.topics,
            toneTags: (metrics.toneTags ?? []) as string[],
          })
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
              personalizedScore: personalized,
            }) * maturePenalty.multiplier
          )
        }

        const hasYouthAppeal = hasYouthAppealSignal({
          mediaGenres: media.genres,
          mediaTopics: media.topics,
          memberAge,
          genreScore,
          interestsScore,
          positiveScore,
        })
        const adultLeaning = isAdultLeaningContentForMinor({
          mediaGenres: media.genres,
          expertAgeRec: media.expertAgeRec,
          memberAge,
          hasYouthAppeal,
        })

        const guarded = applyFitGuardrails({
          score: rawScore,
          memberAge,
          expertAgeRec: media.expertAgeRec,
          hasRichProfile: hasPreferences,
          hasYouthAppeal,
          adultLeaning,
          matureCaution: maturePenalty.severity === "caution",
        })

        // Hard age gate: never show a child on content rated 2+ years above their age
        if (media.expertAgeRec != null && memberAge != null && media.expertAgeRec >= memberAge + 2) {
          continue
        }

        // Adults always shown — universal-appeal content (Nintendo, Ghibli, etc.) is relevant to parents

        // Only include members with decent fit (>= 60)
        if (guarded.score >= 60 && !guarded.ageWarning) {
          const ageVerdict = ageVerdictFromAges(memberAge, media.expertAgeRec)
          const prefReasons: string[] = []
          if (maturePenalty.reason) {
            prefReasons.push(maturePenalty.reason.charAt(0).toUpperCase() + maturePenalty.reason.slice(1))
          }
          let prefPillar: PreferencePillar = hasPreferences ? "good" : "noProfile"
          if (maturePenalty.severity === "block") prefPillar = "avoid"
          else if (maturePenalty.severity === "caution") prefPillar = "check"
          else if (hasPreferences && guarded.score >= 80) prefPillar = "love"
          const preferenceVerdict: PreferenceVerdict = {
            pillar: prefPillar,
            label: PREFERENCE_PILLAR_LABELS[prefPillar],
            reasons: prefReasons,
          }
          fittingMembers.push({
            id: member.id,
            name: member.name,
            emoji: member.avatarEmoji,
            avatarStyle: member.avatarStyle,
            avatarSeed: member.avatarSeed,
            avatarOptions: member.avatarOptions as Record<string, unknown> | null,
            score: guarded.score,
            level: legacyLevelFromPillars(ageVerdict.pillar, prefPillar),
            reason: guarded.reasonOverride ?? maturePenalty.reason ?? undefined,
            ageVerdict,
            preferenceVerdict,
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
