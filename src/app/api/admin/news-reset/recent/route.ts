import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"

const DEFAULT_LOOKBACK_HOURS = 72

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const url = new URL(req.url)
  const lookbackHours = Math.max(
    1,
    Math.min(168, Number(url.searchParams.get("hours") ?? DEFAULT_LOOKBACK_HOURS)),
  )
  const dryRun = url.searchParams.get("dryRun") === "true"
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)

  try {
    const [recentBriefs, latestDossier] = await Promise.all([
      prisma.newsStory.findMany({
        where: {
          status: "PUBLISHED",
          storyType: "BRIEF",
          publishedAt: { gte: since },
        },
        select: { id: true, title: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      }),
      prisma.newsStory.findFirst({
        where: { status: "PUBLISHED", storyType: "DOSSIER" },
        select: { id: true, title: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      }),
    ])

    if (!dryRun) {
      await prisma.newsStory.updateMany({
        where: { id: { in: recentBriefs.map((s) => s.id) } },
        data: { status: "ARCHIVED" },
      })
      if (latestDossier) {
        await prisma.newsStory.update({
          where: { id: latestDossier.id },
          data: { status: "ARCHIVED" },
        })
      }
    }

    await logCronRun({
      task: "news-reset-recent",
      status: "success",
      summary: `${dryRun ? "Prévisualisation" : "Archive"} : ${recentBriefs.length} briefs récents${latestDossier ? " + 1 dossier" : ""}`,
      details: {
        dryRun,
        lookbackHours,
        since: since.toISOString(),
        archivedBriefIds: recentBriefs.map((s) => s.id),
        archivedDossierId: latestDossier?.id ?? null,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      lookbackHours,
      since: since.toISOString(),
      archivedBriefs: recentBriefs.length,
      archivedDossier: latestDossier
        ? {
            id: latestDossier.id,
            title: latestDossier.title,
            publishedAt: latestDossier.publishedAt,
          }
        : null,
      sampleBriefs: recentBriefs.slice(0, 8).map((s) => ({
        id: s.id,
        title: s.title,
        publishedAt: s.publishedAt,
      })),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    await logCronRun({
      task: "news-reset-recent",
      status: "error",
      summary: msg,
      startTime,
    })
    return NextResponse.json({ error: "Reset failed", message: msg }, { status: 500 })
  }
}
