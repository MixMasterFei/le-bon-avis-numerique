/**
 * Deterministic assembly of a /decouverte page. NO LLM import belongs in this
 * file — by the time we get here the question is already a set of clamped
 * filters, and everything below is ordinary catalogue querying: the same
 * `runSmartFilter` the homepage's personalized rail uses, the same where-builder,
 * the same title/theme matchers as the search page.
 *
 * That separation is the whole safety argument of the feature: ages, content
 * scores and per-child fit come from the database, never from generation.
 */
import { prisma } from "@/lib/prisma"
import { runSmartFilter, type SmartFilterResultItem } from "@/lib/smart-filter"
import { buildSmartFilterWhere } from "@/app/api/filter/smart/scoring"
import { resolveAvoidFilters } from "./vocab"
import type { NlIntent } from "./types"

/** Mirrored from PersonalizedRail — the proven "fits everyone" threshold. */
const MIN_SCORE = 40

export interface AssembledCard {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: Record<string, unknown> | null
  /** Feeds the richer editorial atoms (lede lines); null on thin rows. */
  synopsisFr?: string | null
  topics?: string[]
  releaseDate?: string | null
  /** Anonymous path only — the family engine's select doesn't carry it, and
   *  section-level wide art resolves separately (sectionImageFor). */
  backdropUrl?: string | null
  /** Per-member fit, present only for a logged-in family. */
  memberScores?: { memberId: string; memberName: string; score: number }[]
}

type MediaRow = {
  id: string
  type: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: unknown
  synopsisFr: string | null
  topics: string[]
  releaseDate: Date | null
  backdropUrl: string | null
}

function toType(type: string): AssembledCard["type"] {
  return type === "TV" ? "TV" : type === "GAME" ? "GAME" : "MOVIE"
}

function rowToCard(row: MediaRow): AssembledCard {
  return {
    id: row.id,
    type: toType(row.type),
    title: row.title,
    posterUrl: row.posterUrl,
    expertAgeRec: row.expertAgeRec,
    genres: row.genres ?? [],
    contentMetrics: (row.contentMetrics as Record<string, unknown> | null) ?? null,
    synopsisFr: row.synopsisFr,
    topics: row.topics ?? [],
    releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
    backdropUrl: row.backdropUrl,
  }
}

function smartItemToCard(item: SmartFilterResultItem): AssembledCard {
  return {
    id: item.mediaId,
    type: toType(item.type),
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec,
    genres: item.genres ?? [],
    contentMetrics: item.contentMetrics,
    synopsisFr: item.synopsisFr,
    topics: item.topics ?? [],
    releaseDate: item.releaseDate ? item.releaseDate.toISOString() : null,
    memberScores: item.memberScores.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      score: m.score,
    })),
  }
}

const CARD_SELECT = {
  id: true,
  type: true,
  title: true,
  posterUrl: true,
  expertAgeRec: true,
  genres: true,
  contentMetrics: true,
  synopsisFr: true,
  topics: true,
  releaseDate: true,
  backdropUrl: true,
} as const

/**
 * Anonymous / member-less path. `runSmartFilter` needs family members to score
 * against and returns null without them, so we reuse its where-builder directly
 * and skip the scoring pass: plain, honest filtering with no personalization
 * claim attached. `isEnriched: true` is enforced inside the builder, so
 * unscored provisional titles can't slip in as falsely safe.
 */
async function runAnonFilter(intent: NlIntent, limit: number, maxAgeOverride?: number): Promise<AssembledCard[]> {
  const avoid = resolveAvoidFilters(intent.eviter)
  const maxAge = maxAgeOverride ?? intent.maxAge ?? undefined

  const where = buildSmartFilterWhere({
    mediaType: intent.mediaType,
    members: [],
    genres: [],
    topics: intent.themes,
    platforms: intent.platforms,
    search: "",
    requirePoster: true,
    language: intent.mediaType === "GAME" ? "" : "fr,en",
    minAge: intent.minAge ?? undefined,
    maxAge,
    youngestAge: null,
    strictMode: false,
    excludeTags: avoid.excludeTags,
    maxViolence: avoid.maxViolence,
  })

  const rows = await prisma.mediaItem.findMany({
    where,
    select: CARD_SELECT,
    take: limit,
    orderBy: [
      { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { dataQualityScore: "desc" },
    ],
  })
  return rows.map(rowToCard)
}

/** Logged-in path: per-member scoring, so each card carries its fit. */
async function runFamilyFilter(
  intent: NlIntent,
  userId: string,
  memberIds: string[],
  limit: number,
  maxAgeOverride?: number,
): Promise<{ items: AssembledCard[]; members: { id: string; name: string }[] } | null> {
  const avoid = resolveAvoidFilters(intent.eviter)
  const result = await runSmartFilter({
    userId,
    familyMemberIds: memberIds,
    mediaType: intent.mediaType,
    limit,
    // ALL selected members must fit — a title that doesn't suit the youngest is
    // excluded, not averaged away (same contract as the homepage rail).
    strictMode: true,
    minScore: MIN_SCORE,
    topics: intent.themes,
    platforms: intent.platforms,
    requirePoster: true,
    language: intent.mediaType === "GAME" ? "" : "fr,en",
    ...(intent.minAge !== null ? { minAge: intent.minAge } : {}),
    ...(maxAgeOverride !== undefined
      ? { maxAge: maxAgeOverride }
      : intent.maxAge !== null
        ? { maxAge: intent.maxAge }
        : {}),
    excludeTags: avoid.excludeTags,
    maxViolence: avoid.maxViolence,
  })
  if (!result) return null
  return { items: result.results.map(smartItemToCard), members: result.members }
}

/**
 * One catalogue query for a (possibly modified) intent, picking the personalized
 * or anonymous path automatically. Every rail on a composed board goes through
 * here — a "same thing but in games" rail is this function with a rewritten
 * mediaType, not a second query language.
 */
export async function runNlQuery(opts: {
  intent: NlIntent
  userId: string | null
  memberIds: string[]
  limit: number
  maxAgeOverride?: number
}): Promise<{ items: AssembledCard[]; members: { id: string; name: string }[]; personalized: boolean }> {
  const { intent, userId, memberIds, limit, maxAgeOverride } = opts

  if (userId && memberIds.length > 0) {
    const family = await runFamilyFilter(intent, userId, memberIds, limit, maxAgeOverride)
    if (family) return { ...family, personalized: true }
  }
  return { items: await runAnonFilter(intent, limit, maxAgeOverride), members: [], personalized: false }
}

/** Fetch an ordered id list back into cards, preserving relevance order. */
export async function fetchByIds(ids: string[], limit: number): Promise<AssembledCard[]> {
  if (ids.length === 0) return []
  const rows = await prisma.mediaItem.findMany({
    where: { id: { in: ids.slice(0, limit) } },
    select: CARD_SELECT,
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered: AssembledCard[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (row) ordered.push(rowToCard(row))
  }
  return ordered
}
