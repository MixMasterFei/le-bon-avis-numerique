import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { getGameDetails } from "@/lib/igdb"
import { deriveGameStyleTags } from "@/lib/game-style-tags"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// Re-enrich existing games with Steam-style tags (src/lib/game-style-tags.ts)
// by re-fetching full IGDB metadata (keywords + perspectives + modes + themes).
// Deterministic + idempotent. Cursor-driven over id:
//   POST /api/admin/backfill-game-styles?limit=60[&cursor=<lastId>]
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "60")), 100)
  const cursor = searchParams.get("cursor")
  const TIME_BUDGET_MS = 265_000

  const games = await prisma.mediaItem.findMany({
    where: { type: "GAME", igdbId: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
    select: { id: true, igdbId: true },
    orderBy: { id: "asc" },
    take: limit,
  })

  const stats = { examined: 0, updated: 0, errors: 0 }
  let lastId: string | null = null
  let bailed = false

  for (const g of games) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      bailed = true
      break
    }
    stats.examined++
    lastId = g.id
    try {
      const detail = await getGameDetails(g.igdbId as number)
      if (!detail) {
        stats.errors++
        continue
      }
      await prisma.mediaItem.update({ where: { id: g.id }, data: { topics: deriveGameStyleTags(detail) } })
      stats.updated++
      await new Promise((r) => setTimeout(r, 90))
    } catch {
      stats.errors++
    }
  }

  const done = !bailed && games.length < limit
  const nextCursor = done ? null : lastId

  await logCronRun({
    task: "backfill-game-styles",
    status: stats.errors > 10 ? "partial" : "success",
    summary: `${stats.updated} jeux re-taggés (style Steam)`,
    details: { ...stats, done, nextCursor },
    startTime,
  })

  return NextResponse.json({ success: true, done, nextCursor, stats })
}
