import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { isBlockedHotlinkImageUrl, isLowQualityImagePublisher } from "@/lib/news-image-policy"

export const maxDuration = 60

// One-time backlog recovery for the V4 "directSource" feed.
//
// Recent stories were carded because the hydration dimension gate threw away
// their image (the server-side probe under-reads publisher CDNs) and the raw
// URL was never stored. We can't re-match the RSS feeds — older articles have
// already scrolled out of the feed window — but each story stores its permanent
// article URL. So we fetch the article page and read its og:image (the
// publisher's own lead image), then stamp sourceImageUrl with it.
//
// No dimension gate (the browser renders the full-size hotlink). Blocked-hotlink
// hosts (e.g. sortiraparis CDN) and low-quality-image publishers are skipped.
// Time-budgeted + idempotent (re-queries sourceImageUrl IS NULL each call), so
// the Operations tile loops until `remaining` is 0.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

interface SourceEntry {
  name?: string
  url?: string
}

/** Fetch an article page and return its og:image / twitter:image, if any. */
async function scrapeOgImage(articleUrl: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": BROWSER_UA, accept: "text/html" },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = (res.headers.get("content-type") ?? "").toLowerCase()
    if (!ct.includes("html")) return null
    const html = await res.text()
    const $ = cheerio.load(html)
    const candidates = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
    ]
    for (const c of candidates) {
      const url = (c ?? "").trim()
      if (url && /^https?:\/\//i.test(url)) return url
    }
    return null
  } catch {
    return null
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startTime = Date.now()
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30), 1), 120)
  const batch = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 40), 1), 80)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  // Date cursor (newest-first): each call sweeps the next-older batch and moves
  // PAST it — so unrecoverable stories (no og:image / 403) aren't retried every
  // call, and the visible (newest) feed fills first. The window total is
  // counted once and carried forward for the progress bar.
  const afterTsRaw = req.nextUrl.searchParams.get("afterTs")
  const afterTs = afterTsRaw ? new Date(Number(afterTsRaw)) : null
  const totalParam = req.nextUrl.searchParams.get("total")

  const candidates = await prisma.newsStory.findMany({
    where: {
      status: "PUBLISHED",
      sourceImageUrl: null,
      publishedAt: afterTs ? { gte: since, lt: afterTs } : { gte: since },
    },
    select: { id: true, sources: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: batch,
  })
  const total = totalParam
    ? Number(totalParam)
    : await prisma.newsStory.count({ where: { status: "PUBLISHED", sourceImageUrl: null, publishedAt: { gte: since } } })

  let attempted = 0
  const results = await mapConcurrent(candidates, 6, async (story) => {
    const sources: SourceEntry[] = Array.isArray(story.sources) ? (story.sources as SourceEntry[]) : []
    for (const s of sources) {
      if (!s.url || isLowQualityImagePublisher(s.name)) continue
      attempted++
      const og = await scrapeOgImage(s.url)
      if (og && !isBlockedHotlinkImageUrl(og)) {
        await prisma.newsStory.update({ where: { id: story.id }, data: { sourceImageUrl: og } })
        return true
      }
    }
    return false
  })
  const updated = results.filter(Boolean).length
  const lastTs = candidates.length > 0 ? candidates[candidates.length - 1].publishedAt.getTime() : null
  const done = candidates.length < batch // reached the oldest story in the window

  await logCronRun({
    task: "news.reimageBacklog",
    status: "success",
    summary: `Re-imaged ${updated}/${candidates.length} carded stories via og:image`,
    details: { scanned: candidates.length, attempted, updated, total, days },
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
