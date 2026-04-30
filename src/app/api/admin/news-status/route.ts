import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Admin diagnostic: counts of news_stories grouped by status x
 * storyType, plus the most recent rows of each PUBLISHED bucket.
 * Useful after a /admin/news-rebuild run to see whether briefs were
 * dropped at the synthesis stage, the quality-judge stage, or never
 * ran at all.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const user = session?.user as { email?: string | null; role?: string } | undefined
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const grouped = await prisma.newsStory.groupBy({
      by: ["status", "storyType", "region"],
      _count: { _all: true },
    })

    const recentPublished = await prisma.newsStory.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: {
        id: true,
        slug: true,
        title: true,
        storyType: true,
        region: true,
        publishedAt: true,
      },
    })

    const recentPending = await prisma.newsStory.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: {
        id: true,
        slug: true,
        title: true,
        storyType: true,
        region: true,
        publishedAt: true,
      },
    })

    const recentCronLogs = await prisma.cronLog.findMany({
      where: { task: { in: ["news-discover", "news-rebuild", "weekly-dossier"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { task: true, status: true, summary: true, createdAt: true, duration: true },
    })

    return NextResponse.json({
      counts: grouped.map((g) => ({
        status: g.status,
        storyType: g.storyType,
        region: g.region,
        count: g._count._all,
      })),
      recentPublished,
      recentPending,
      recentCronLogs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
