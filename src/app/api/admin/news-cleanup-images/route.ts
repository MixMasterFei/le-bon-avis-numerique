import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"

export const maxDuration = 60

/**
 * One-shot (or chunked) cleanup for legacy NewsStory rows whose
 * imageUrl returns non-200, 0 bytes, or a non-image content-type.
 * Marks them ARCHIVED so they disappear from /actualites without
 * being hard-deleted (we keep the row for audit / dedup purposes).
 *
 * Run via POST /api/admin/news-cleanup-images?limit=20 (or trigger
 * from the admin OperationsCenter once added). Idempotent — already-
 * archived rows are skipped, healthy rows aren't touched.
 */

interface CleanupResult {
  processed: number
  archived: number
  healthy: number
  errors: number
  remaining: number
  done: boolean
  details: string[]
}

async function isImageBroken(url: string): Promise<{ broken: boolean; reason?: string }> {
  if (isBlockedHotlinkImageUrl(url)) {
    return { broken: true, reason: "blocked hotlink host" }
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { broken: true, reason: `HTTP ${res.status}` }
    const ct = res.headers.get("content-type") || ""
    if (!ct.startsWith("image/")) return { broken: true, reason: `content-type ${ct}` }
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 5_000) return { broken: true, reason: `${buf.byteLength}B` }
    return { broken: false }
  } catch (e) {
    return { broken: true, reason: e instanceof Error ? e.message : "fetch failed" }
  }
}

export async function POST(req: Request) {
  let body: { limit?: number; afterId?: string } = {}
  try {
    body = await req.json()
  } catch {
    // No body is fine.
  }
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50)

  const candidates = await prisma.newsStory.findMany({
    where: {
      status: "PUBLISHED",
      ...(body.afterId ? { id: { gt: body.afterId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, title: true, imageUrl: true },
  })

  const result: CleanupResult = {
    processed: 0,
    archived: 0,
    healthy: 0,
    errors: 0,
    remaining: 0,
    done: false,
    details: [],
  }

  for (const s of candidates) {
    result.processed += 1
    try {
      const check = await isImageBroken(s.imageUrl)
      if (check.broken) {
        await prisma.newsStory.update({
          where: { id: s.id },
          data: { status: "ARCHIVED" },
        })
        result.archived += 1
        result.details.push(`✗ ${s.title.slice(0, 60)} — ${check.reason}`)
      } else {
        result.healthy += 1
      }
    } catch (e) {
      result.errors += 1
      result.details.push(`! ${s.id}: ${e instanceof Error ? e.message : "unknown"}`)
    }
  }

  const lastId = candidates[candidates.length - 1]?.id
  const remainingCount = lastId
    ? await prisma.newsStory.count({
        where: { status: "PUBLISHED", id: { gt: lastId } },
      })
    : 0

  result.remaining = remainingCount
  result.done = remainingCount === 0

  return NextResponse.json({
    ...result,
    lastId,
  })
}
