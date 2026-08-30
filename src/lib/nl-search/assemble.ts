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
import { getMemberAge } from "@/lib/age-utils"
import { runSmartFilter, type SmartFilterResultItem } from "@/lib/smart-filter"
import { buildSmartFilterWhere } from "@/app/api/filter/smart/scoring"
import { matchMediaIdsByTheme, matchMediaIdsByTitle } from "@/lib/search-normalize"
import { resolveAvoidFilters } from "./vocab"
import type { NlIntent } from "./types"

/** Settings mirrored from PersonalizedRail — the proven "fits everyone" shape. */
const MAIN_LIMIT = 18
const MIN_SCORE = 40
const SECONDARY_LIMIT = 12
/** Below this many main results, a secondary rail is noise rather than help. */
const SECONDARY_MIN_MAIN = 6

export interface AssembledCard {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: Record<string, unknown> | null
  /** Per-member fit, present only for a logged-in family. */
  memberScores?: { memberId: string; memberName: string; score: number }[]
}

export interface AssembledRail {
  title: string
  items: AssembledCard[]
}

export interface AssembledResults {
  items: AssembledCard[]
  secondary: AssembledRail | null
  /** True when per-member scoring ran (a logged-in family with members). */
  personalized: boolean
  members: { id: string; name: string }[]
}

type MediaRow = {
  id: string
  type: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: unknown
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

/** Fetch an ordered id list back into cards, preserving relevance order. */
async function fetchByIds(ids: string[], limit: number): Promise<AssembledCard[]> {
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

export interface AssembleOptions {
  intent: NlIntent
  /** Original question — used by the keyword paths. */
  query: string
  userId: string | null
}

export async function assembleResults(opts: AssembleOptions): Promise<AssembledResults> {
  const { intent, query, userId } = opts
  const empty: AssembledResults = { items: [], secondary: null, personalized: false, members: [] }

  if (intent.mode === "hors_sujet") return empty

  // A named work: look it up directly, no filtering theatre around it.
  if (intent.mode === "titre" && intent.titre) {
    const ids = await matchMediaIdsByTitle(intent.titre, { limit: MAIN_LIMIT })
    return { ...empty, items: await fetchByIds(ids, MAIN_LIMIT) }
  }

  // No usable interpretation: keyword search over themes and titles, which is
  // what the rest of the site does with a raw query string.
  if (intent.mode === "texte") {
    const [themeIds, titleIds] = await Promise.all([
      matchMediaIdsByTheme(query, { limit: 40 }),
      matchMediaIdsByTitle(query, { limit: 12 }),
    ])
    const merged = Array.from(new Set([...titleIds, ...themeIds]))
    return { ...empty, items: await fetchByIds(merged, MAIN_LIMIT) }
  }

  // Structured filters.
  const members = userId
    ? await prisma.familyMember.findMany({
        where: { userId },
        select: { id: true, name: true, birthYear: true, birthMonth: true },
      })
    : []

  let items: AssembledCard[] = []
  let personalized = false
  let memberList: { id: string; name: string }[] = []

  if (userId && members.length > 0) {
    const family = await runFamilyFilter(intent, userId, members.map((m) => m.id), MAIN_LIMIT)
    if (family) {
      items = family.items
      memberList = family.members
      personalized = true
    }
  }
  if (!personalized) {
    items = await runAnonFilter(intent, MAIN_LIMIT)
  }

  // Secondary rail — one extra deterministic query, and only when the main set
  // is substantial enough that a complement reads as a bonus, not as filler.
  let secondary: AssembledRail | null = null
  if (intent.railSecondaire && items.length >= SECONDARY_MIN_MAIN) {
    if (intent.railSecondaire === "plus_jeunes" && intent.maxAge !== null) {
      const youngerAge = Math.max(3, intent.maxAge - 3)
      const railItems = personalized && userId
        ? (await runFamilyFilter(intent, userId, members.map((m) => m.id), SECONDARY_LIMIT, youngerAge))?.items ?? []
        : await runAnonFilter(intent, SECONDARY_LIMIT, youngerAge)
      const seen = new Set(items.map((i) => i.id))
      const fresh = railItems.filter((i) => !seen.has(i.id))
      if (fresh.length >= 3) {
        secondary = { title: "Pour les plus jeunes de la famille", items: fresh }
      }
    } else if (intent.railSecondaire === "en_serie" && intent.mediaType !== "TV") {
      const tvIntent: NlIntent = { ...intent, mediaType: "TV" }
      const railItems = personalized && userId
        ? (await runFamilyFilter(tvIntent, userId, members.map((m) => m.id), SECONDARY_LIMIT))?.items ?? []
        : await runAnonFilter(tvIntent, SECONDARY_LIMIT)
      if (railItems.length >= 3) {
        secondary = { title: "La même ambiance, en série", items: railItems }
      }
    }
  }

  return { items, secondary, personalized, members: memberList }
}

/** Ages of the signed-in family's members — used for the "pour qui" chips. */
export function memberAges(members: { birthYear: number | null; birthMonth: number | null }[]): (number | null)[] {
  return members.map((m) => getMemberAge(m.birthYear, m.birthMonth))
}
