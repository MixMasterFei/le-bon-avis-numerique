import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchBooks } from "@/lib/google-books"

export const maxDuration = 60

/**
 * @deprecated RETIRED — manga pipeline decommissioned May 2026.
 *
 * Retroactive Google Books lookup for MANGA rows that don't yet have
 * French-edition data. Fills publisher + latestVolumeDate +
 * googleBookId where possible. Non-fatal on miss — manga without a
 * French edition entry simply stay as-is.
 *
 * This route is kept for potential manual data maintenance but is NOT
 * called by any automated workflow. Do NOT add it to cron.yml.
 */

interface BackfillResult {
  processed: number
  matched: number
  skipped: number
  errors: number
  remaining: number
  done: boolean
  lastId?: string
}

export async function POST(req: Request) {
  let body: { limit?: number; afterId?: string } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is fine
  }

  const limit = Math.min(Math.max(body.limit ?? 10, 1), 30)
  const afterId = body.afterId

  const items = await prisma.mediaItem.findMany({
    where: {
      type: "MANGA",
      googleBookId: null,
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, title: true, director: true },
  })

  const result: BackfillResult = {
    processed: 0,
    matched: 0,
    skipped: 0,
    errors: 0,
    remaining: 0,
    done: false,
    lastId: items[items.length - 1]?.id,
  }

  for (const item of items) {
    result.processed += 1
    try {
      const authorHint = item.director ? ` inauthor:${item.director.split(",")[0]}` : ""
      const results = await searchBooks(`${item.title}${authorHint}`, {
        maxResults: 3,
        langRestrict: "fr",
      })
      const first = results.items?.[0]
      if (!first) {
        result.skipped += 1
        continue
      }

      const publishedAt = first.volumeInfo.publishedDate
        ? new Date(first.volumeInfo.publishedDate)
        : undefined

      await prisma.mediaItem.update({
        where: { id: item.id },
        data: {
          googleBookId: first.id,
          latestVolumeDate:
            publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        },
      })
      result.matched += 1
    } catch (e) {
      result.errors += 1
      console.error(`[backfill-manga-editions] ${item.id}:`, e)
    }
  }

  const remainingCount = await prisma.mediaItem.count({
    where: {
      type: "MANGA",
      googleBookId: null,
      ...(result.lastId ? { id: { gt: result.lastId } } : {}),
    },
  })
  result.remaining = remainingCount
  result.done = remainingCount === 0

  return NextResponse.json(result)
}
