import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { COLLECTIONS, getCollectionDef, type CollectionDef, type CollectionQuery } from "@/lib/collections-data"
import { NON_POSTER_URLS } from "@/lib/media-route"

// Server-side collection fetchers — shared by the /collections pages (server
// components since July 2026: the lists must be in the crawled HTML) and the
// legacy /api/collections route. react cache() dedupes the page + metadata
// fetches within one request.

export interface CollectionItem {
  id: string
  title: string
  originalTitle: string | null
  type: string
  posterUrl: string | null
  releaseDate: string | undefined
  expertAgeRec: number | null
  genres: string[]
  synopsisFr: string | null
  contentMetrics: { violence: number; positiveMessages: number } | null
}

export interface CollectionSummary {
  id: string
  title: string
  description: string
  emoji: string
  limit: number
  category: "top" | "seasonal"
  lastUpdated: string
  count: number
  previewPosters: string[]
  /** Seasonal in-season months (0-indexed) — see CollectionDef.months. */
  months?: number[]
}

const ITEM_SELECT = {
  id: true,
  title: true,
  originalTitle: true,
  type: true,
  posterUrl: true,
  releaseDate: true,
  expertAgeRec: true,
  genres: true,
  synopsisFr: true,
  contentMetrics: { select: { violence: true, positiveMessages: true } },
} as const

type RawItem = {
  id: string
  title: string
  originalTitle: string | null
  type: string
  posterUrl: string | null
  releaseDate: Date | null
  expertAgeRec: number | null
  genres: string[]
  synopsisFr: string | null
  contentMetrics: { violence: number; positiveMessages: number } | null
}

function toItem(item: RawItem): CollectionItem {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    type: item.type,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate?.toISOString().split("T")[0],
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    synopsisFr: item.synopsisFr,
    contentMetrics: item.contentMetrics,
  }
}

function buildWhereClause(query: CollectionQuery) {
  const where: Record<string, unknown> = {}
  if (query.type) where.type = query.type
  if (query.maxAge != null) where.expertAgeRec = { lte: query.maxAge }
  if (query.year) {
    where.releaseDate = {
      gte: new Date(`${query.year}-01-01`),
      lt: new Date(`${query.year + 1}-01-01`),
    }
  }
  if (query.topics?.length) where.topics = { hasSome: query.topics }
  if (query.genres?.length) where.genres = { hasSome: query.genres }
  if (query.excludeGenres?.length) where.NOT = { genres: { hasSome: query.excludeGenres } }
  if (query.requireLanguage?.length) where.originalLanguage = { in: query.requireLanguage }
  // Vote floor: without it, a 1-vote perfect-10 obscurity tops every dynamic
  // year list (observed on "meilleurs films 2025" before July 2026).
  if (query.minVotes != null) where.tmdbVoteCount = { gte: query.minVotes }
  return where
}

/** Fetch specific items by ID, preserving the curated order. */
async function getCuratedItems(ids: string[]): Promise<CollectionItem[]> {
  const items = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
    select: ITEM_SELECT,
  })
  const itemMap = new Map(items.map((item) => [item.id, item]))
  return ids
    .map((id) => itemMap.get(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map(toItem)
}

// Bayesian weighted rating (IMDb-style): pulls low-vote titles toward the
// prior so an 8.7-with-20-votes curiosity can't outrank a 7.9-with-2600-votes
// crowd-pleaser on the "meilleurs films de l'année" lists.
const WR_PRIOR_VOTES = 200
const WR_PRIOR_RATING = 6.5
function weightedRating(rating: number | null, votes: number | null): number {
  const r = rating ?? 0
  const v = votes ?? 0
  return (v / (v + WR_PRIOR_VOTES)) * r + (WR_PRIOR_VOTES / (v + WR_PRIOR_VOTES)) * WR_PRIOR_RATING
}

/** Fetch items dynamically via query filters. */
async function getDynamicItems(query: CollectionQuery, limit: number): Promise<CollectionItem[]> {
  const where = buildWhereClause(query)
  // Quality gates
  where.posterUrl = { not: null, notIn: [...NON_POSTER_URLS] }
  if (!("expertAgeRec" in where)) where.expertAgeRec = { not: null }
  where.releaseDate = { ...((where.releaseDate as object) || {}), lte: new Date() }

  const raw = await prisma.mediaItem.findMany({
    where,
    select: { ...ITEM_SELECT, tmdbRating: true, tmdbVoteCount: true },
    orderBy: [
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { releaseDate: "desc" },
    ],
    take: limit * 3,
  })
  return raw
    .sort(
      (a, b) =>
        weightedRating(b.tmdbRating, b.tmdbVoteCount) - weightedRating(a.tmdbRating, a.tmdbVoteCount),
    )
    .slice(0, limit)
    .map(toItem)
}

export const getCollectionWithItems = cache(
  async (id: string): Promise<{ collection: CollectionDef; items: CollectionItem[] } | null> => {
    const collection = getCollectionDef(id)
    if (!collection) return null
    const items = collection.curatedIds
      ? await getCuratedItems(collection.curatedIds)
      : await getDynamicItems(collection.query!, collection.limit)
    return { collection, items }
  },
)

/** Hub data: every collection with its live count + 4 preview posters. */
export const getCollectionSummaries = cache(async (): Promise<CollectionSummary[]> => {
  const summaries = await Promise.all(
    COLLECTIONS.map(async (collection): Promise<CollectionSummary> => {
      let count = 0
      let posters: string[] = []

      if (collection.curatedIds) {
        const items = await prisma.mediaItem.findMany({
          where: { id: { in: collection.curatedIds }, posterUrl: { not: null } },
          select: { id: true, posterUrl: true },
        })
        count = collection.curatedIds.length
        const itemMap = new Map(items.map((i) => [i.id, i.posterUrl]))
        posters = collection.curatedIds
          .map((id) => itemMap.get(id))
          .filter((p): p is string => Boolean(p))
          .slice(0, 4)
      } else if (collection.query) {
        const items = await getDynamicItems(collection.query, collection.limit)
        count = items.length
        posters = items
          .map((i) => i.posterUrl)
          .filter((p): p is string => Boolean(p))
          .slice(0, 4)
      }

      return {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        emoji: collection.emoji,
        limit: collection.limit,
        category: collection.category,
        lastUpdated: collection.lastUpdated,
        count,
        previewPosters: posters,
        months: collection.months,
      }
    }),
  )
  // A dynamic collection can legitimately be thin early in the year — hide it
  // until it has enough to look intentional.
  return summaries.filter((c) => c.count >= 3)
})
