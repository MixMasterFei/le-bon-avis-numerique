import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { floorExpertAgeBySignals } from "@/lib/age-floor"

export const maxDuration = 60

/**
 * Deterministic age-floor sweep.
 *
 * Applies `floorExpertAgeBySignals` to already-enriched titles so content
 * rated too young is bumped up:
 *  - MOVIE/TV: content-justified floor (a "Tous Publics" classic sitting in
 *    an 8-12 band — Forrest Gump, war dramas…).
 *  - GAME: PEGI legal-minimum floor (the June 2026 baseline showed ~42% of
 *    games rated below their PEGI age).
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

  // Candidate window — only titles a floor could raise (the floor never
  // lowers, so already-mature titles are skipped):
  //  - films/séries in the young/teen bands (≤13, the content floor's max is 14)
  //  - PEGI-rated games below 18 (a PEGI 18 floor can raise anything under it)
  const items = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        isEnriched: true,
        OR: [
          {
            type: { in: ["MOVIE", "TV"] },
            expertAgeRec: { not: null, lte: 13 },
            contentMetrics: { isNot: null },
          },
          {
            type: "GAME",
            expertAgeRec: { not: null, lte: 17 },
            officialRating: { startsWith: "PEGI_" },
          },
        ],
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
        officialRating: true,
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
      officialRating: item.officialRating,
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
