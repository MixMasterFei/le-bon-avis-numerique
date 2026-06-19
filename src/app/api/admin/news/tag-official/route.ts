import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { isOfficialSourceName } from "@/lib/news-sources"

export const maxDuration = 60

// Backfill the NewsStory.official flag (powers the V5 "Actualités de confiance"
// feed). New stories are tagged at ingestion in news-discover.ts; this re-tags
// EXISTING rows by matching their `sources` JSON against the in-code official
// source set (gov / public institution / recognized nonprofit).
//
// Strict gate: a story is official only when EVERY contributing source is
// official. Recomputes both ways (sets true OR false), so re-running after the
// source list changes (e.g. a source renamed/added/removed in news-sources.ts)
// keeps the column correct. Date-cursor (newest-first), idempotent, chunkable.

interface SourceEntry {
  name?: unknown
}

/** True only when the story has sources and every one is official. */
function isOfficialStory(sources: Prisma.JsonValue): boolean {
  if (!Array.isArray(sources) || sources.length === 0) return false
  return sources.every((entry) => {
    if (!entry || typeof entry !== "object") return false
    const name = (entry as SourceEntry).name
    return typeof name === "string" && isOfficialSourceName(name)
  })
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startTime = Date.now()
  const batch = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 200), 1), 500)
  const afterTsRaw = req.nextUrl.searchParams.get("afterTs")
  const afterTs = afterTsRaw ? new Date(Number(afterTsRaw)) : null
  const totalParam = req.nextUrl.searchParams.get("total")

  const candidates = await prisma.newsStory.findMany({
    where: afterTs ? { publishedAt: { lt: afterTs } } : {},
    select: { id: true, sources: true, official: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: batch,
  })
  const total = totalParam ? Number(totalParam) : await prisma.newsStory.count()

  let updated = 0
  for (const story of candidates) {
    const desired = isOfficialStory(story.sources)
    if (desired !== story.official) {
      await prisma.newsStory.update({ where: { id: story.id }, data: { official: desired } })
      updated++
    }
  }

  const lastTs = candidates.length > 0 ? candidates[candidates.length - 1].publishedAt.getTime() : null
  const done = candidates.length < batch

  await logCronRun({
    task: "news.tagOfficial",
    status: "success",
    summary: `Tagged ${updated}/${candidates.length} stories (official source gate)`,
    details: { scanned: candidates.length, updated, total },
    startTime,
  })

  return NextResponse.json({
    ok: true,
    done,
    processed: updated,
    scanned: candidates.length,
    updated,
    total,
    lastTs,
    durationMs: Date.now() - startTime,
  })
}
