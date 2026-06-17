/**
 * Shared family smart-filter engine. Resolves each selected member's effective
 * preferences (member overrides → family defaults), builds the where-clause,
 * fetches a popularity-ordered window, scores every item per member, then sorts
 * by family fit. Used by:
 *   - POST /api/filter/smart  (the advanced "Adapter à mon foyer" surface —
 *     strictMode + minScore: HIDES content below the bar)
 *   - /films, /series, /jeux  (browse "soft re-rank": strictMode=false +
 *     minScore=0 → nothing is hidden, items are only re-ORDERED by fit)
 *
 * NOTE on coverage: scoring is in-memory, so we fetch a bounded window
 * (`take`, default 500) ordered by popularity, then re-rank. Titles beyond
 * that window in the chosen age band won't appear in a member view — an
 * accepted limit shared with the advanced filter (see docs/tech-audit.md,
 * "Smart filter caps at 500").
 */
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { resolveEffectivePrefs } from "@/lib/family-prefs"
import {
  buildSmartFilterWhere,
  calculateMemberScore,
  type MemberPreferences,
} from "@/app/api/filter/smart/scoring"

export interface SmartFilterResultItem {
  mediaId: string
  title: string
  originalTitle: string | null
  type: string
  posterUrl: string | null
  releaseDate: Date | null
  synopsisFr: string | null
  officialRating: string | null
  expertAgeRec: number | null
  genres: string[]
  topics: string[]
  platforms: string[]
  contentMetrics: Record<string, unknown> | null
  familyScore: number
  memberScores: { memberId: string; memberName: string; score: number; concerns: string[] }[]
  hasAnyConcerns: boolean
}

export interface RunSmartFilterParams {
  userId: string
  familyMemberIds: string[]
  mediaType?: string
  limit?: number
  offset?: number
  /** true = ALL members must pass (min score); false = average. */
  strictMode?: boolean
  /** Drop items scoring below this. 0 = keep everything (browse re-rank). */
  minScore?: number
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  search?: string
  requirePoster?: boolean
  language?: string
  minAge?: number
  maxAge?: number
  /** Size of the popularity-ordered window scored in memory. */
  take?: number
}

export interface RunSmartFilterResult {
  members: { id: string; name: string }[]
  results: SmartFilterResultItem[]
  total: number
  offset: number
  limit: number
  /** True when the popularity window was full → more titles exist beyond it
   *  (coverage limit). Lets the UI say so instead of silently truncating. */
  capped: boolean
}

/**
 * Returns scored + sorted results, or null when the caller's member ids don't
 * resolve to any of THIS user's family members (caller decides how to respond).
 */
export async function runSmartFilter(params: RunSmartFilterParams): Promise<RunSmartFilterResult | null> {
  const {
    userId,
    familyMemberIds,
    mediaType = "MOVIE",
    limit = 20,
    offset = 0,
    strictMode = false,
    minScore = 60,
    genres = [],
    platforms = [],
    topics = [],
    search = "",
    requirePoster = false,
    language = "",
    minAge,
    maxAge,
    take = 1000,
  } = params

  if (!Array.isArray(familyMemberIds) || familyMemberIds.length === 0) return null

  const familyMembers = await prisma.familyMember.findMany({
    where: { id: { in: familyMemberIds }, userId },
  })
  if (familyMembers.length === 0) return null

  const familySettings = await prisma.familySettings.findUnique({ where: { userId } })

  // Effective prefs: member overrides, else family defaults (shared helper).
  const memberPreferences: MemberPreferences[] = familyMembers.map((member) => {
    const eff = resolveEffectivePrefs(member, familySettings)
    return {
      id: member.id,
      name: member.name,
      birthYear: member.birthYear,
      birthMonth: member.birthMonth,
      sensitivityViolence: eff.sensitivityViolence,
      sensitivityScary: eff.sensitivityScary,
      sensitivitySexual: eff.sensitivitySexual,
      sensitivityLanguage: eff.sensitivityLanguage,
      sensitivitySubstances: eff.sensitivitySubstances,
      preferPositiveMessages: eff.preferPositiveMessages,
      preferRoleModels: eff.preferRoleModels,
      preferEducational: eff.preferEducational,
      favoriteGenres: member.favoriteGenres,
      dislikedGenres: member.dislikedGenres,
      avoidTopics: eff.avoidTopics,
      interests: member.interests,
    }
  })

  const ages = memberPreferences
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => a !== null)
  const youngestAge = ages.length > 0 ? Math.min(...ages) : null

  const whereClause = buildSmartFilterWhere({
    mediaType,
    members: memberPreferences,
    genres,
    platforms,
    topics,
    search,
    requirePoster,
    language,
    minAge,
    maxAge,
    youngestAge,
    strictMode,
  })

  const mediaItems = await prisma.mediaItem.findMany({
    where: whereClause,
    include: { contentMetrics: true },
    take,
    orderBy: [
      { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { dataQualityScore: "desc" },
    ],
  })

  const results: SmartFilterResultItem[] = []
  for (const media of mediaItems) {
    const metrics = media.contentMetrics || {
      violence: 0,
      sexNudity: 0,
      language: 0,
      substanceUse: 0,
      positiveMessages: 3,
      roleModels: 3,
      emotionalThemes: [] as string[],
    }

    const memberResults = memberPreferences.map((member) => {
      const { score, concerns } = calculateMemberScore(
        member,
        {
          expertAgeRec: media.expertAgeRec,
          violence: metrics.violence,
          sexNudity: metrics.sexNudity,
          language: metrics.language,
          substanceUse: metrics.substanceUse,
          positiveMessages: metrics.positiveMessages,
          roleModels: metrics.roleModels,
          genres: media.genres,
          topics: media.topics,
          emotionalThemes: (metrics.emotionalThemes ?? []) as string[],
        },
        strictMode,
      )
      return { memberId: member.id, memberName: member.name, score, concerns }
    })

    const familyScore = strictMode
      ? Math.min(...memberResults.map((r) => r.score))
      : memberResults.reduce((sum, r) => sum + r.score, 0) / memberResults.length

    if (familyScore < minScore) continue

    results.push({
      mediaId: media.id,
      title: media.title,
      originalTitle: media.originalTitle,
      type: media.type,
      posterUrl: media.posterUrl,
      releaseDate: media.releaseDate,
      synopsisFr: media.synopsisFr,
      officialRating: media.officialRating,
      expertAgeRec: media.expertAgeRec,
      genres: media.genres,
      topics: media.topics,
      platforms: media.platforms,
      contentMetrics: media.contentMetrics as Record<string, unknown> | null,
      familyScore: Math.round(familyScore),
      memberScores: memberResults,
      hasAnyConcerns: memberResults.some((r) => r.concerns.length > 0),
    })
  }

  // Sort by family fit, popularity as tiebreaker.
  const popularity = new Map<string, { voteCount: number; rating: number }>()
  for (const m of mediaItems) {
    popularity.set(m.id, { voteCount: m.tmdbVoteCount ?? 0, rating: m.tmdbRating ?? 0 })
  }
  results.sort((a, b) => {
    if (b.familyScore !== a.familyScore) return b.familyScore - a.familyScore
    const pa = popularity.get(a.mediaId) ?? { voteCount: 0, rating: 0 }
    const pb = popularity.get(b.mediaId) ?? { voteCount: 0, rating: 0 }
    if (pb.voteCount !== pa.voteCount) return pb.voteCount - pa.voteCount
    return pb.rating - pa.rating
  })

  return {
    members: memberPreferences.map((m) => ({ id: m.id, name: m.name })),
    results: results.slice(offset, offset + limit),
    total: results.length,
    offset,
    limit,
    capped: mediaItems.length === take,
  }
}
