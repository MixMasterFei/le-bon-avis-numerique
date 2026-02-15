import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/admin/screenshots/cleanup
 *
 * Fast DB-only cleanup that removes duplicate screenshots without needing TMDB API.
 *
 * Strategy: For each media item, keep only every other screenshot (by order).
 * TMDB language variants (same scene, different text overlay) tend to be adjacent
 * in vote_average sort order, so skipping every other one effectively deduplicates.
 *
 * Then renumber remaining screenshots with clean order values.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { maxPerMedia = 3, dryRun = false } = body

    // Get all media items that have screenshots
    const mediaWithScreenshots = await prisma.mediaItem.findMany({
      where: { screenshots: { some: {} } },
      select: {
        id: true,
        title: true,
        screenshots: {
          orderBy: { order: "asc" },
          select: { id: true, url: true, order: true, width: true, height: true },
        },
      },
    })

    let totalBefore = 0
    let totalAfter = 0
    let totalDeleted = 0
    const details: string[] = []

    for (const media of mediaWithScreenshots) {
      const screenshots = media.screenshots
      totalBefore += screenshots.length

      if (screenshots.length <= maxPerMedia) {
        totalAfter += screenshots.length
        continue
      }

      // Pick evenly-spaced screenshots to maximize visual diversity
      // e.g., from 6 screenshots, pick indices 0, 2, 4 (every other)
      const step = Math.max(1, Math.floor(screenshots.length / maxPerMedia))
      const keepIds = new Set<string>()
      for (let i = 0; i < screenshots.length && keepIds.size < maxPerMedia; i += step) {
        keepIds.add(screenshots[i].id)
      }
      // If we don't have enough yet, fill from the start
      for (const s of screenshots) {
        if (keepIds.size >= maxPerMedia) break
        keepIds.add(s.id)
      }

      const deleteIds = screenshots
        .filter((s) => !keepIds.has(s.id))
        .map((s) => s.id)

      if (!dryRun && deleteIds.length > 0) {
        await prisma.mediaScreenshot.deleteMany({
          where: { id: { in: deleteIds } },
        })

        // Renumber remaining screenshots
        const remaining = screenshots.filter((s) => keepIds.has(s.id))
        for (let i = 0; i < remaining.length; i++) {
          await prisma.mediaScreenshot.update({
            where: { id: remaining[i].id },
            data: { order: i },
          })
        }
      }

      totalAfter += keepIds.size
      totalDeleted += deleteIds.length
      if (deleteIds.length > 0) {
        details.push(`"${media.title}": ${screenshots.length} → ${keepIds.size}`)
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stats: {
        mediaProcessed: mediaWithScreenshots.length,
        screenshotsBefore: totalBefore,
        screenshotsAfter: totalAfter,
        deleted: totalDeleted,
      },
      details: details.slice(0, 50), // Limit output
    })
  } catch (error) {
    console.error("Screenshot cleanup error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/screenshots/cleanup
 * Preview what would be cleaned up (dry run)
 */
export async function GET() {
  const mediaWithMany = await prisma.mediaItem.findMany({
    where: {
      screenshots: { some: {} },
    },
    select: {
      id: true,
      title: true,
      _count: { select: { screenshots: true } },
    },
    orderBy: { title: "asc" },
  })

  const withDuplicates = mediaWithMany.filter((m) => m._count.screenshots > 3)

  return NextResponse.json({
    totalMedia: mediaWithMany.length,
    mediaWithMoreThan3: withDuplicates.length,
    examples: withDuplicates.slice(0, 20).map((m) => ({
      title: m.title,
      screenshotCount: m._count.screenshots,
    })),
  })
}
