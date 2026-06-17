import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { floorExpertAgeBySignals } from "@/lib/age-floor"

export const maxDuration = 60

/**
 * Deterministic age-floor sweep.
 *
 * Applies `floorExpertAgeBySignals` to already-enriched MOVIE/TV titles so
 * mature content rated too young (a "Tous Publics" classic sitting in an 8-12
 * band — Forrest Gump, war dramas…) is bumped up to a content-justified age.
 * Zero LLM cost, deterministic, idempotent (the floor only ever raises, and a
 * raised title leaves the candidate window). Cursor-paginated by id so the
 * GitHub Action can loop it.
 *
 * Query params:
 *   dry      – "true" to report changes without writing (default false)
 *   limit    – batch size (default 200)
 *   afterId  – cursor; only process ids greater than this
 */
async function run(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const dry = url.searchParams.get("dry") === "true"
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "200")))
  const afterId = url.searchParams.get("afterId") || undefined

  // Candidate window: enriched films/séries currently in the young/teen bands
  // (≤13) — those are the only ones a content floor could raise. Already-mature
  // titles are skipped (the floor never lowers).
  const items = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
        isEnriched: true,
        expertAgeRec: { not: null, lte: 13 },
        contentMetrics: { isNot: null },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        genres: true,
        topics: true,
        expertAgeRec: true,
        contentMetrics: {
          select: {
            violence: true,
            sexNudity: true,
            language: true,
            substanceUse: true,
            visualStyle: true,
          },
        },
      },
    }),
  )

  let raised = 0
  const changes: string[] = []

  for (const item of items) {
    if (typeof item.expertAgeRec !== "number") continue
    const floored = floorExpertAgeBySignals({
      expertAgeRec: item.expertAgeRec,
      metrics: item.contentMetrics,
      genres: item.genres,
      topics: item.topics,
      visualStyle: item.contentMetrics?.visualStyle ?? null,
      type: item.type,
    })
    if (floored > item.expertAgeRec) {
      raised++
      if (changes.length < 100) changes.push(`${item.title}: ${item.expertAgeRec} → ${floored}`)
      if (!dry) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { expertAgeRec: floored },
        })
      }
    }
  }

  const lastId = items.length > 0 ? items[items.length - 1].id : null
  const done = items.length < limit

  return NextResponse.json({
    dry,
    processed: items.length,
    raised,
    lastId,
    done,
    changes,
  })
}

export async function POST(req: NextRequest) {
  return run(req)
}
