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

// Admin-only diagnostic. Emitted under the `_debug` key per media so a
// non-admin response shape stays unchanged. Lets the homepage overlay
// explain WHY a member was filtered (Eliott avoid · Drame disliked).
interface ExcludedMember {
  id: string
  name: string
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({})
    }

    // Admin-only flag — drives the _debug field that surfaces per-member
    // exclusion reasons under empty/partial cards on the homepage rail.
    const isAdmin = session.user.role === "ADMIN"

    const body = await request.json()
    const mediaIds: string[] = Array.isArray(body?.mediaIds) ? body.mediaIds.slice(0, 50) : []

    if (mediaIds.length === 0) {
      return NextResponse.json({})
    }

    // Fetch family members. createdAt:asc matches the canonical order used
    // on the profile page + other listings, so the pills under each card
    // always appear in the same left-to-right sequence (e.g. always Erwan,
    // Mathis, Eliott). Without this, the per-media score sort shuffled them
    // around and the grid was hard to read.
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
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

    // Build result: { [mediaId]: { members: MemberFit[], familyWarning?: boolean, communityFlagged?: boolean, _debug?: { excluded: ExcludedMember[] } } }
    const result: Record<
      string,
      {
        members: MemberFit[]
        familyWarning?: boolean
        communityFlagged?: boolean
        _debug?: { excluded: ExcludedMember[] }
      }
    > = {}

    for (const media of mediaItems) {
      const metrics = media.contentMetrics ?? DEFAULT_FIT_METRICS

      // Household-level warning signals. We still compute per-member fits even
      // when these fire — the cards that want to render an orange warning
      // badge instead of avatars (legacy MediaCard) can read the flag, while
      // the homepage v2 ApercuMediaCard renders avatars from `members`. This
      // way a member who is genuinely a good fit (e.g. Erwan 14 with stated
      // violence:0 on Avengers) still shows as an avatar instead of being
      // silently dropped.
      const communityFlagCount = warningCountMap.get(media.id) || 0
      const communityFlagged = communityFlagCount >= COMMUNITY_WARNING_THRESHOLD
      const algorithmicWarning = hasMinor && isFamilyWarningContent(
        media.genres,
        { violence: metrics.violence, sexNudity: metrics.sexNudity, toneTags: (metrics.toneTags ?? []) as string[] },
        media.expertAgeRec,
      )
      const familyWarning = communityFlagged || algorithmicWarning

      const fittingMembers: MemberFit[] = []
      // Tracks who got filtered and why. Only attached to the response
      // when the requester is admin (drives the homepage debug overlay).
      const excludedForDebug: ExcludedMember[] = []

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
        let avoidScore: number | undefined
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
          avoidScore = computeAvoidScore(media.topics, member.avoidTopics)
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

        // Derive the two pillars first — they double as the inclusion gate.
        // We deliberately do NOT filter on guarded.score anymore: avatars
        // signal "this is the target audience", and the avatar ring color
        // already encodes the fit band (very adapted / good / check). Older
        // kids on younger-skewing content (e.g. Erwan 14 on Tomodachi 7+)
        // were silently dropped by the old >=60 gate because ageScore tanks
        // when the gap exceeds 3 years.
        const ageVerdict = ageVerdictFromAges(memberAge, media.expertAgeRec)

        // Preference pillar — mirrors the per-media route's
        // preferencePillarFromSignals so that disliked-genre and avoid-topic
        // hard short-circuits (computeWeightedFitScore floors at 10 when
        // genreScore===0 or avoidScore===0) propagate as the "avoid" pillar.
        // The previous inline logic missed these, so a member who quizzed
        // "no horror" could still slip onto a Horror card's avatars.
        let prefPillar: PreferencePillar
        if (avoidScore === 0) prefPillar = "avoid"
        else if (genreScore === 0) prefPillar = "avoid"
        else if (maturePenalty.severity === "block") prefPillar = "avoid"
        else if (!hasPreferences) prefPillar = "noProfile"
        else if (maturePenalty.severity === "caution") prefPillar = "check"
        else if (guarded.level === "moderate" || guarded.score < 66) prefPillar = "check"
        else if (guarded.score >= 80) prefPillar = "love"
        else prefPillar = "good"

        // Inclusion rule: every age-appropriate member who hasn't been
        // explicitly ruled out by their preferences. We allow "borderline"
        // (gap=1) so a 9-year-old on a 10+ title still appears with an amber
        // ring — the badge will say "Limite d'âge" rather than hiding them.
        if (ageVerdict.pillar === "tooEarly") {
          if (isAdmin) {
            const detail = media.expertAgeRec != null && memberAge != null
              ? `âge ${memberAge} · dès ${media.expertAgeRec}`
              : "âge insuffisant"
            excludedForDebug.push({ id: member.id, name: member.name, reason: `trop tôt · ${detail}` })
          }
          continue
        }
        if (prefPillar === "avoid") {
          if (isAdmin) {
            // Identify which gate fired so the overlay can show exactly
            // which dislike/avoid topic was responsible.
            const normalise = (s: string) => s.toLowerCase().trim()
            const mediaGenresLc = media.genres.map(normalise)
            const mediaTopicsLc = media.topics.map(normalise)
            const dislikedHit = member.dislikedGenres.find((g) => mediaGenresLc.includes(normalise(g)))
            const avoidHit = member.avoidTopics.find((t) => mediaTopicsLc.includes(normalise(t)))
            let why: string
            if (dislikedHit) why = `genre rejeté : ${dislikedHit}`
            else if (avoidHit) why = `sujet à éviter : ${avoidHit}`
            else if (maturePenalty.severity === "block") why = "contenu mature bloqué"
            else why = "préférence non favorable"
            excludedForDebug.push({ id: member.id, name: member.name, reason: `avoid · ${why}` })
          }
          continue
        }

        const prefReasons: string[] = []
        if (maturePenalty.reason) {
          prefReasons.push(maturePenalty.reason.charAt(0).toUpperCase() + maturePenalty.reason.slice(1))
        }
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

      // Intentionally NOT sorted by score — fittingMembers inherits the
      // creation-order iteration above so members stay in the same column
      // across every card on the page. Sorting by score made the row
      // reshuffle on each card and the grid was unreadable.

      // Emit a result entry whenever there is something to show — either
      // members, a household warning, or (admin only) exclusions worth
      // explaining. The admin debug overlay reads `_debug.excluded` so the
      // bare "Shrek 2 has no avatars" cards stop being a black box.
      if (fittingMembers.length > 0 || familyWarning || (isAdmin && excludedForDebug.length > 0)) {
        const entry: {
          members: MemberFit[]
          familyWarning?: boolean
          communityFlagged?: boolean
          _debug?: { excluded: ExcludedMember[] }
        } = {
          members: fittingMembers,
        }
        if (familyWarning) entry.familyWarning = true
        if (communityFlagged) entry.communityFlagged = true
        if (isAdmin && excludedForDebug.length > 0) {
          entry._debug = { excluded: excludedForDebug }
        }
        result[media.id] = entry
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
