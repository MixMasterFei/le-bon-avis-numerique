import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const revalidate = 1800

interface StatsResponse {
  counts: {
    movies: number
    series: number
    games: number
    families: number
    reactions: number
    ageVotes: number
    reviews: number
  }
  lastImportAt: string | null
  latestAdditions: Array<{
    id: string
    type: string
    title: string
    posterUrl: string | null
    addedAt: string
  }>
  weeklyBuzz: Array<{
    id: string
    type: string
    title: string
    posterUrl: string | null
    reactionCount: number
  }>
}

export async function GET() {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      movies,
      series,
      games,
      families,
      reactions,
      ageVotes,
      reviews,
      latestAdditions,
      weeklyReactionsGrouped,
      lastImport,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: { type: "MOVIE" } }),
      prisma.mediaItem.count({ where: { type: "TV" } }),
      prisma.mediaItem.count({ where: { type: "GAME" } }),
      prisma.familyMember.count(),
      prisma.mediaReaction.count(),
      prisma.ageVote.count(),
      prisma.review.count(),
      prisma.mediaItem.findMany({
        where: {
          posterUrl: { not: null },
          releaseDate: { lte: new Date() },
          dataQualityScore: { gte: 50 },
          // Manga is admin-only during soft launch — exclude from the
          // public "Fraîchement ajoutés" rail so visitors don't see it.
          type: { not: "MANGA" },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          posterUrl: true,
          createdAt: true,
        },
      }),
      prisma.mediaReaction.groupBy({
        by: ["mediaId"],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { mediaId: true },
        orderBy: { _count: { mediaId: "desc" } },
        take: 5,
      }),
      prisma.cronLog.findFirst({
        where: { task: "import", status: { in: ["success", "partial"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ])

    const buzzMediaIds = weeklyReactionsGrouped.map((r) => r.mediaId)
    const buzzMediaItems = buzzMediaIds.length
      ? await prisma.mediaItem.findMany({
          // Same MANGA exclusion as latestAdditions above (admin-only soft launch).
          where: { id: { in: buzzMediaIds }, posterUrl: { not: null }, type: { not: "MANGA" } },
          select: { id: true, type: true, title: true, posterUrl: true },
        })
      : []
    const buzzMap = new Map(buzzMediaItems.map((m) => [m.id, m]))
    const weeklyBuzz = weeklyReactionsGrouped
      .map((r) => {
        const media = buzzMap.get(r.mediaId)
        if (!media) return null
        return {
          id: media.id,
          type: media.type,
          title: media.title,
          posterUrl: media.posterUrl,
          reactionCount: r._count.mediaId,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const payload: StatsResponse = {
      counts: {
        movies,
        series,
        games,
        families,
        reactions,
        ageVotes,
        reviews,
      },
      lastImportAt: lastImport?.createdAt.toISOString() ?? null,
      latestAdditions: latestAdditions.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        posterUrl: m.posterUrl,
        addedAt: m.createdAt.toISOString(),
      })),
      weeklyBuzz,
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    })
  } catch (error) {
    console.error("[stats/public] failed:", error)
    return NextResponse.json({ error: "Stats unavailable" }, { status: 500 })
  }
}
