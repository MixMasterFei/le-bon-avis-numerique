import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { floorExpertAgeBySignals } from "@/lib/age-floor"
import { logCronRun } from "@/lib/cron-log"

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

  const startTime = Date.now()
  const url = new URL(req.url)
  const dry = url.searchParams.get("dry") === "true"
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "200")))
  const afterId = url.searchParams.get("afterId") || undefined

  // Candidate window — only titles a floor could raise (the floor never
  // lowers, so already-mature titles are skipped):
  //  - films/séries in the young/teen bands (≤13, the content floor's max is 14)
  //  - games below 18. Deliberately NOT restricted to PEGI-rated games: the
  //    2026-07-11 incident was a NO-PEGI horror indie game (the horror-topic +
  //    axis fallback floors it to 14), so restricting to `officialRating
  //    startsWith "PEGI_"` here would leave that exact class uncovered by the
  //    scheduled sweep. Scanning all games ≤17 is cheap and idempotent.
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

  // Log each real (non-dry) call so the supervisor/debt-digest can see the
  // weekly sweep ran. Self-draining: `raised` legitimately sits at ~0 once the
  // catalogue is floored, so there is NO output-anomaly check on it (see the
  // EXPECTED_TASKS note) — staleness alone is monitored.
  if (!dry) {
    await logCronRun({
      task: "age-floor",
      status: "success",
      summary: `Age-floor sweep: ${raised} relevé(s) sur ${items.length} examiné(s)${done ? " (terminé)" : ""}`,
      details: { processed: items.length, raised, done, changes: changes.slice(0, 20) },
      startTime,
    })
  }

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
