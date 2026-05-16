import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { deriveNewsImageConcept } from "@/lib/news-image-concepts"
import { isFallbackCardUrl } from "@/lib/news-image"

export const maxDuration = 30

type AuditTier =
  | "OFFICIAL_PRESS"
  | "AGENCY_LICENSED"
  | "STOCK_CONTEXTUAL"
  | "EDITORIAL_FALLBACK"
  | "PUBLISHER_RSS"
  | "PUBLISHER_OG"
  | "UNKNOWN"

function tierFor(row: {
  imageSourceType: string | null
  imageCredit: string | null
  imageUrl: string
}): AuditTier {
  if (row.imageSourceType === "STOCK") return "STOCK_CONTEXTUAL"
  if (row.imageSourceType === "FALLBACK" || isFallbackCardUrl(row.imageUrl)) return "EDITORIAL_FALLBACK"
  if (row.imageSourceType === "AGENCY") {
    return row.imageCredit?.toLowerCase().includes("asset officiel")
      ? "OFFICIAL_PRESS"
      : "AGENCY_LICENSED"
  }
  if (row.imageSourceType === "PUBLISHER_RSS") return "PUBLISHER_RSS"
  if (row.imageSourceType === "PUBLISHER_OG") return "PUBLISHER_OG"
  return "UNKNOWN"
}

function addCount(map: Record<string, number>, key: string, inc = 1) {
  map[key] = (map[key] ?? 0) + inc
}

function topEntries(map: Record<string, number>, limit = 8) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  let body: { limit?: number } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is fine.
  }
  const limit = Math.min(Math.max(body.limit ?? 240, 24), 500)

  const rows = await prisma.newsStory.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      title: true,
      summary: true,
      category: true,
      imageUrl: true,
      imageSourceType: true,
      imageCredit: true,
    },
  })

  const tierCounts: Record<string, number> = {}
  const stockQueries: Record<string, number> = {}
  const fallbackKeys: Record<string, number> = {}
  let publisherRssCurrent = 0
  let publisherRssAvoidedEstimate = 0

  for (const row of rows) {
    const tier = tierFor(row)
    addCount(tierCounts, tier)

    const concept = deriveNewsImageConcept({
      title: row.title,
      summary: row.summary,
      category: row.category,
    })
    addCount(stockQueries, concept.query)

    if (tier === "EDITORIAL_FALLBACK") {
      const url = new URL(row.imageUrl, "https://totemavise.com")
      addCount(fallbackKeys, `${url.searchParams.get("cat") ?? "UNKNOWN"}:${url.searchParams.get("seed") ? "seeded" : "legacy"}`)
    }

    if (tier === "PUBLISHER_RSS" || tier === "PUBLISHER_OG") {
      publisherRssCurrent += 1
      publisherRssAvoidedEstimate += 1
    }
  }

  const total = rows.length
  const tierPercentages = Object.fromEntries(
    Object.entries(tierCounts).map(([tier, count]) => [
      tier,
      total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    ]),
  )

  return NextResponse.json({
    ok: true,
    processed: total,
    total,
    updated: publisherRssAvoidedEstimate,
    skipped: tierCounts.EDITORIAL_FALLBACK ?? 0,
    tierCounts,
    tierPercentages,
    publisherRssCurrent,
    publisherRssAvoidedEstimate,
    topStockQueries: topEntries(stockQueries),
    topFallbacks: topEntries(fallbackKeys),
  })
}
