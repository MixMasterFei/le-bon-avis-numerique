import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { findPressKitTargetsForStory } from "@/lib/official-press-registry"

export const maxDuration = 60

function intParam(value: string | null, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.floor(parsed)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)))
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const startTime = Date.now()
  const search = req.nextUrl.searchParams
  const limit = Math.min(Math.max(intParam(search.get("limit"), 60), 1), 120)
  const days = Math.min(Math.max(intParam(search.get("days"), 21), 1), 120)
  const afterId = search.get("afterId") ?? undefined
  const since = daysAgo(days)

  let scanned = 0
  let detected = 0
  let created = 0
  let alreadyKnown = 0
  let errors = 0
  const brands: Record<string, number> = {}

  try {
    const stories = await prisma.newsStory.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: since },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        sources: true,
      },
    })

    for (const story of stories) {
      scanned += 1
      const targets = findPressKitTargetsForStory(story).slice(0, 3)
      if (targets.length === 0) continue

      detected += targets.length
      for (const target of targets) {
        const { entry } = target
        brands[entry.brand] = (brands[entry.brand] ?? 0) + 1
        try {
          const existing = await prisma.officialPressAsset.findFirst({
            where: {
              brand: entry.brand,
              assetType: "press_kit_reference",
              sourceUrl: entry.pressKitUrl,
            },
            select: { id: true },
          })
          if (existing) {
            alreadyKnown += 1
            continue
          }

          await prisma.officialPressAsset.create({
            data: {
              brand: entry.brand,
              product: entry.product,
              assetType: "press_kit_reference",
              title: `${entry.product ?? entry.brand} press kit reference`,
              sourceUrl: entry.pressKitUrl,
              storageUrl: null,
              credit: entry.brand,
              licenseUrl: null,
              termsUrl: entry.termsUrl ?? entry.newsroomUrl ?? entry.pressKitUrl,
              termsSummary: `${entry.termsSummary} Detected from story: ${story.title}`,
              tags: uniqueTags([...entry.tags, "press-kit-reference"]),
              active: false,
            },
          })
          created += 1
        } catch (err) {
          errors += 1
          console.warn("[press-kit-scout] candidate create failed:", err)
        }
      }

      if (Date.now() - startTime > 50_000) break
    }

    const lastId = stories[Math.min(scanned, stories.length) - 1]?.id ?? afterId ?? null
    const remaining = lastId
      ? await prisma.newsStory.count({
          where: {
            status: "PUBLISHED",
            publishedAt: { gte: since },
            id: { gt: lastId },
          },
        })
      : await prisma.newsStory.count({ where: { status: "PUBLISHED", publishedAt: { gte: since } } })
    const done = scanned === 0 || remaining === 0

    await logCronRun({
      task: "news.pressKitScout",
      status: errors > 0 ? "partial" : "success",
      summary: `Press kits: ${created} references ajoutees, ${alreadyKnown} deja connues, ${detected} detections`,
      details: { scanned, detected, created, alreadyKnown, errors, brands, remaining, lastId, days },
      startTime,
    })

    return NextResponse.json({
      ok: true,
      done,
      scanned,
      processed: scanned,
      detected,
      created,
      alreadyKnown,
      errors,
      brands,
      remaining,
      lastId,
      days,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    await logCronRun({
      task: "news.pressKitScout",
      status: "error",
      summary: `Press kit scout failed: ${message}`,
      details: { scanned, detected, created, alreadyKnown, errors, error: message, days },
      startTime,
    })
    console.error("[press-kit-scout] failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
