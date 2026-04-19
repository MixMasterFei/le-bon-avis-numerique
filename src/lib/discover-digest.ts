import { prisma } from "@/lib/prisma"
import type { Prisma, NewsCategory } from "@prisma/client"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import type { ApercuCardMedia } from "@/components/home-v2/ApercuMediaCard"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface LovedMedia extends ApercuCardMedia {
  loveCount: number
}

export interface WeekStats {
  reactions: number
  reviews: number
  newUsers: number
}

export interface DiscoverDigest {
  heroStory: ApercuNewsCardData | null
  recentStories: ApercuNewsCardData[]
  recentReleases: ApercuCardMedia[]
  topLoved: LovedMedia[]
  weekStats: WeekStats
  lastSynthesisAt: Date | null
}

function toSources(raw: Prisma.JsonValue | null): NewsSourceRef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url) return []
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
      },
    ]
  })
}

function rowToStory(r: {
  slug: string
  title: string
  summary: string
  imageUrl: string
  category: NewsCategory
  publishedAt: Date
  sources: Prisma.JsonValue
}): ApercuNewsCardData {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    imageUrl: r.imageUrl,
    category: r.category,
    publishedAt: r.publishedAt,
    sources: toSources(r.sources),
  }
}

interface MediaRow {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: {
    violence: number | null
    sexNudity: number | null
    language: number | null
    substanceUse: number | null
  } | null
}

function rowToMediaCard(r: MediaRow): ApercuCardMedia {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    posterUrl: r.posterUrl,
    expertAgeRec: r.expertAgeRec,
    genres: r.genres,
    contentMetrics: r.contentMetrics,
  }
}

const mediaCardSelect = {
  id: true,
  type: true,
  title: true,
  posterUrl: true,
  expertAgeRec: true,
  genres: true,
  contentMetrics: {
    select: {
      violence: true,
      sexNudity: true,
      language: true,
      substanceUse: true,
    },
  },
} satisfies Prisma.MediaItemSelect

export async function fetchDiscoverDigest(): Promise<DiscoverDigest> {
  const now = new Date()
  const week = new Date(now.getTime() - 7 * MS_PER_DAY)
  const twoDays = new Date(now.getTime() - 2 * MS_PER_DAY)
  const threeDays = new Date(now.getTime() - 3 * MS_PER_DAY)
  const month = new Date(now.getTime() - 30 * MS_PER_DAY)

  const [
    heroRow,
    recentRows,
    releaseRows,
    lovedGrouped,
    reactionCount,
    reviewCount,
    newUserCount,
    lastSynthesis,
  ] = await Promise.all([
    // Hero — top relevance, last 48h
    prisma.newsStory.findFirst({
      where: { status: "PUBLISHED", publishedAt: { gte: twoDays } },
      orderBy: [{ relevanceScore: "desc" }, { publishedAt: "desc" }],
      select: {
        slug: true, title: true, summary: true, imageUrl: true,
        category: true, publishedAt: true, sources: true,
      },
    }),
    // Actu — 6 newest, excluding hero (filtered client-side after we know hero id)
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: threeDays } },
      orderBy: [{ publishedAt: "desc" }, { relevanceScore: "desc" }],
      take: 8, // grab a few extra; trim to 6 after excluding hero
      select: {
        slug: true, title: true, summary: true, imageUrl: true,
        category: true, publishedAt: true, sources: true,
      },
    }),
    // Sorties — 6 most recent dated catalog entries with a poster
    prisma.mediaItem.findMany({
      where: {
        releaseDate: { gte: month, lte: now },
        posterUrl: { not: null },
        type: { in: ["MOVIE", "TV", "GAME"] },
      },
      orderBy: { releaseDate: "desc" },
      take: 6,
      select: mediaCardSelect,
    }),
    // Top loved — group MediaReaction by mediaId, last 7d
    prisma.mediaReaction.groupBy({
      by: ["mediaId"],
      where: { reaction: "LOVED", createdAt: { gte: week } },
      _count: { _all: true },
      orderBy: { _count: { mediaId: "desc" } },
      take: 4,
    }).catch(() => []),
    prisma.mediaReaction.count({ where: { createdAt: { gte: week } } }).catch(() => 0),
    prisma.review.count({ where: { createdAt: { gte: week } } }).catch(() => 0),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.newsStory.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
  ])

  const hero = heroRow ? rowToStory(heroRow) : null

  // Trim recents to 6, excluding hero (if present in the slice)
  const recentStories = recentRows
    .filter((r) => !hero || r.slug !== hero.slug)
    .slice(0, 6)
    .map(rowToStory)

  const recentReleases = releaseRows.map((r) => rowToMediaCard(r as MediaRow))

  // Hydrate the loved media items with their data + count
  const lovedIds = lovedGrouped.map((g) => g.mediaId)
  const lovedMediaRows =
    lovedIds.length > 0
      ? await prisma.mediaItem.findMany({
          where: { id: { in: lovedIds } },
          select: mediaCardSelect,
        })
      : []
  const lovedById = new Map(lovedMediaRows.map((m) => [m.id, m]))
  const topLoved: LovedMedia[] = lovedGrouped
    .map((g) => {
      const m = lovedById.get(g.mediaId)
      if (!m) return null
      return { ...rowToMediaCard(m as MediaRow), loveCount: g._count._all }
    })
    .filter((x): x is LovedMedia => x !== null)

  return {
    heroStory: hero,
    recentStories,
    recentReleases,
    topLoved,
    weekStats: {
      reactions: reactionCount,
      reviews: reviewCount,
      newUsers: newUserCount,
    },
    lastSynthesisAt: lastSynthesis?.fetchedAt ?? null,
  }
}
