import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { prepareDiscoveryV4Image } from "@/lib/news-image-assets"

export const maxDuration = 60

function boolParam(value: unknown): boolean {
  return value === true || value === "true" || value === "1"
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json()
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function candidateWhere(afterId?: string): Prisma.NewsStoryWhereInput {
  return {
    status: "PUBLISHED",
    ...(afterId ? { id: { gt: afterId } } : {}),
    OR: [
      { imageSourceType: null },
      { imageSourceType: "FALLBACK" },
      { imageSourceType: "PUBLISHER_OG" },
      { imageSourceType: "PUBLISHER_RSS" },
      { imageUrl: { contains: "/api/news/fallback-card" } },
      {
        imageAssets: {
          some: {
            variant: "DISCOVERY_V4",
            provider: "totem_editorial",
            approved: true,
          },
        },
      },
    ],
  }
}

function reasonCount(reasons: Record<string, number>, reason: string): number {
  return reasons[reason] ?? 0
}

function reasonPrefixCount(reasons: Record<string, number>, prefix: string): number {
  return Object.entries(reasons).reduce(
    (total, [reason, count]) => total + (reason.startsWith(prefix) ? count : 0),
    0,
  )
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const startTime = Date.now()
  const body = await readBody(req)
  const search = req.nextUrl.searchParams
  const limitRaw = Number(search.get("limit") ?? body.limit ?? 12)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 12, 1), 30)
  const afterId = search.get("afterId") ?? (typeof body.afterId === "string" ? body.afterId : undefined)
  const force = boolParam(search.get("force") ?? body.force)

  let scanned = 0
  let updated = 0
  let skipped = 0
  let rejected = 0
  let errors = 0
  const reasons: Record<string, number> = {}

  const addReason = (reason: string | undefined) => {
    const key = reason || "unknown"
    reasons[key] = (reasons[key] ?? 0) + 1
  }

  try {
    const rows = await prisma.newsStory.findMany({
      where: candidateWhere(afterId),
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        category: true,
      },
    })

    for (const row of rows) {
      scanned += 1
      const result = await prepareDiscoveryV4Image(row, { force })
      addReason(result.reason)
      if (result.status === "updated") updated += 1
      else if (result.status === "skipped") skipped += 1
      else if (result.status === "rejected") rejected += 1
      else errors += 1

      if (Date.now() - startTime > 50_000) break
    }

    const lastId = rows[Math.min(scanned, rows.length) - 1]?.id ?? afterId ?? null
    const remaining = lastId
      ? await prisma.newsStory.count({ where: candidateWhere(lastId) })
      : await prisma.newsStory.count({ where: candidateWhere() })
    const done = scanned === 0 || remaining === 0

    await logCronRun({
      task: "news.prewarmImagesV4",
      status: errors > 0 ? "partial" : "success",
      summary: `V4 images: ${updated} prepared, ${rejected} rejected, ${skipped} skipped (${remaining} remaining)`,
      details: { scanned, updated, skipped, rejected, errors, reasons, remaining, lastId, force },
      startTime,
    })

    return NextResponse.json({
      ok: true,
      done,
      processed: scanned,
      scanned,
      updated,
      skipped,
      rejected,
      errors,
      reasons,
      reasonAlreadyPrepared: reasonCount(reasons, "already_prepared"),
      reasonAlreadyRejected: reasonCount(reasons, "already_rejected"),
      reasonLowConfidence: reasonCount(reasons, "low_confidence"),
      reasonNoIntent: reasonCount(reasons, "no_intent"),
      reasonNoStockMatch: reasonCount(reasons, "no_stock_match"),
      reasonStorageFailed: reasonPrefixCount(reasons, "storage_"),
      reasonStorageDisabled: reasonCount(reasons, "storage_storage_disabled"),
      reasonStorageClientUnavailable: reasonCount(reasons, "storage_client_unavailable"),
      reasonStorageSourceHttpError: reasonCount(reasons, "storage_source_http_error"),
      reasonStorageNonImage: reasonCount(reasons, "storage_non_image_content_type"),
      reasonStoragePayloadTooSmall: reasonCount(reasons, "storage_payload_too_small"),
      reasonStorageDimensionsTooSmall: reasonCount(reasons, "storage_dimensions_too_small"),
      reasonStorageUploadError: reasonCount(reasons, "storage_storage_upload_error"),
      reasonStorageException: reasonCount(reasons, "storage_fetch_or_upload_exception"),
      remaining,
      lastId,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    await logCronRun({
      task: "news.prewarmImagesV4",
      status: "error",
      summary: `V4 image prewarm failed: ${message}`,
      details: { scanned, updated, skipped, rejected, errors, error: message },
      startTime,
    })
    console.error("[prewarm-images-v4] failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
