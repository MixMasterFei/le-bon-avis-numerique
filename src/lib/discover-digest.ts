import { prisma } from "@/lib/prisma"
import type { Prisma, NewsCategory } from "@prisma/client"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import type { ApercuCardMedia } from "@/components/home-v2/ApercuMediaCard"
import { isSeasonalMismatch } from "@/lib/seasonal"

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
  imageCredit: string | null
  imageLicenseUrl: string | null
  category: NewsCategory
  publishedAt: Date
  sources: Prisma.JsonValue
}): ApercuNewsCardData {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    imageUrl: r.imageUrl,
    imageCredit: r.imageCredit,
    imageLicenseUrl: r.imageLicenseUrl,
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
  topics: string[]
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
  topics: true,
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
  const twoMonths = new Date(now.getTime() - 60 * MS_PER_DAY)

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
        slug: true, title: true, summary: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
      },
    }),
    // Actu — 6 newest, excluding hero (filtered client-side after we know hero id)
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: threeDays } },
      orderBy: [{ publishedAt: "desc" }, { relevanceScore: "desc" }],
      take: 8, // grab a few extra; trim to 6 after excluding hero
      select: {
        slug: true, title: true, summary: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
      },
    }),
    // Sorties — family-appropriate recent releases. Cap at age 13 so we
    // cover Disney/Pixar/family cinema (often rated PG-13/12+) without
    // surfacing horror/thriller content. Window widened to 60 days so
    // there's enough material; expertAgeRec must exist (no unverified
    // items lead the row).
    prisma.mediaItem.findMany({
      where: {
        releaseDate: { gte: twoMonths, lte: now },
        posterUrl: { not: null },
        type: { in: ["MOVIE", "TV", "GAME"] },
        expertAgeRec: { not: null, lte: 13 },
      },
      orderBy: { releaseDate: "desc" },
      take: 6,
      select: mediaCardSelect,
    }),
    // Top loved — group MediaReaction by mediaId, last 7d.
    // Engagement signal: organic only (quiz anchors don't reflect this week's actual watching).
    prisma.mediaReaction.groupBy({
      by: ["mediaId"],
      where: { reaction: "LOVED", createdAt: { gte: week }, source: "organic" },
      _count: { _all: true },
      orderBy: { _count: { mediaId: "desc" } },
      // Grab a larger pool than needed so the TMDB-quality filter
      // below can drop niche items and still leave 4 strong picks.
      take: 16,
    }).catch(() => []),
    prisma.mediaReaction.count({ where: { createdAt: { gte: week }, source: "organic" } }).catch(() => 0),
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

  const recentReleases = releaseRows
    .filter((r) => !isSeasonalMismatch(r as MediaRow))
    .map((r) => rowToMediaCard(r as MediaRow))

  // Hydrate the loved media items with their data + count.
  // TMDB quality gate (≥ 6.5 rating, ≥ 200 votes) OR GAME exemption:
  // games don't carry tmdbRating so they'd otherwise always fail the
  // filter. The community LOVED signal already adds one layer of
  // quality — this just prevents a niche one-off from surfacing.
  const lovedIds = lovedGrouped.map((g) => g.mediaId)
  const lovedMediaRows =
    lovedIds.length > 0
      ? await prisma.mediaItem.findMany({
          where: {
            id: { in: lovedIds },
            OR: [
              { type: "GAME" },
              { tmdbRating: { gte: 6.5 }, tmdbVoteCount: { gte: 200 } },
            ],
          },
          select: mediaCardSelect,
        })
      : []
  const lovedById = new Map(
    lovedMediaRows
      .filter((m) => !isSeasonalMismatch(m as MediaRow))
      .map((m) => [m.id, m])
  )
  // Preserve the LOVED-count ordering from groupBy, then cap at 4.
  const topLoved: LovedMedia[] = lovedGrouped
    .map((g) => {
      const m = lovedById.get(g.mediaId)
      if (!m) return null
      return { ...rowToMediaCard(m as MediaRow), loveCount: g._count._all }
    })
    .filter((x): x is LovedMedia => x !== null)
    .slice(0, 4)

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
