import { Prisma, type NewsCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { findContextualStockPhoto } from "@/lib/stock-photo"
import { resolveNewsVisualIntent } from "@/lib/news-visual-intent"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"

export const DISCOVERY_V4_IMAGE_VARIANT = "DISCOVERY_V4"
const MIN_AUTO_APPROVE_CONFIDENCE = 0.72
function isRetryableRejection(reason: string): boolean {
  return reason === "storage_failed" || reason.startsWith("storage_")
}

export interface PreparedNewsImage {
  url: string
  credit: string | null
  licenseUrl: string | null
}

export interface V4ImageStoryInput {
  id: string
  title: string
  summary?: string | null
  body?: string | null
  category: NewsCategory | string
}

export interface PrepareV4ImageResult {
  status: "updated" | "skipped" | "rejected" | "error"
  reason?: string
  assetId?: string
}

function normalizeCategory(category: NewsCategory | string): NewsCategory {
  return category as NewsCategory
}

function asJsonArray(values: string[]): Prisma.InputJsonValue {
  return values
}

async function upsertRejectedAsset(
  story: V4ImageStoryInput,
  data: {
    provider?: string
    query?: string
    negativeTerms?: string[]
    topicLabel?: string
    confidence?: number
    visualIntent?: string
    rejectedReason: string
  },
): Promise<string | undefined> {
  const row = await prisma.newsImageAsset.upsert({
    where: {
      newsStoryId_variant: {
        newsStoryId: story.id,
        variant: DISCOVERY_V4_IMAGE_VARIANT,
      },
    },
    create: {
      newsStoryId: story.id,
      variant: DISCOVERY_V4_IMAGE_VARIANT,
      provider: data.provider ?? "none",
      sourceUrl: null,
      storageUrl: null,
      credit: null,
      licenseUrl: null,
      visualIntent: data.visualIntent ?? data.query ?? "no visual intent",
      query: data.query ?? "",
      negativeTerms: asJsonArray(data.negativeTerms ?? []),
      topicLabel: data.topicLabel,
      category: normalizeCategory(story.category),
      confidence: data.confidence ?? 0,
      qualityScore: data.confidence ?? null,
      approved: false,
      rejectedReason: data.rejectedReason,
    },
    update: {
      provider: data.provider ?? "none",
      sourceUrl: null,
      storageUrl: null,
      credit: null,
      licenseUrl: null,
      visualIntent: data.visualIntent ?? data.query ?? "no visual intent",
      query: data.query ?? "",
      negativeTerms: asJsonArray(data.negativeTerms ?? []),
      topicLabel: data.topicLabel,
      category: normalizeCategory(story.category),
      confidence: data.confidence ?? 0,
      qualityScore: data.confidence ?? null,
      approved: false,
      rejectedReason: data.rejectedReason,
    },
  })
  return row.id
}

export async function getApprovedDiscoveryV4Image(storyId: string): Promise<PreparedNewsImage | null> {
  try {
    const row = await prisma.newsImageAsset.findUnique({
      where: {
        newsStoryId_variant: {
          newsStoryId: storyId,
          variant: DISCOVERY_V4_IMAGE_VARIANT,
        },
      },
      select: {
        approved: true,
        storageUrl: true,
        credit: true,
        licenseUrl: true,
      },
    })
    if (!row?.approved || !row.storageUrl) return null
    return {
      url: row.storageUrl,
      credit: row.credit,
      licenseUrl: row.licenseUrl,
    }
  } catch (err) {
    console.warn("[news-image-assets] read failed:", err)
    return null
  }
}

export async function prepareDiscoveryV4Image(
  story: V4ImageStoryInput,
  options: { force?: boolean } = {},
): Promise<PrepareV4ImageResult> {
  try {
    if (!options.force) {
      const existing = await prisma.newsImageAsset.findUnique({
        where: {
          newsStoryId_variant: {
            newsStoryId: story.id,
            variant: DISCOVERY_V4_IMAGE_VARIANT,
          },
        },
        select: { id: true, approved: true, rejectedReason: true },
      })
      if (existing) {
        const reason = existing.approved ? "already_prepared" : existing.rejectedReason ?? "already_rejected"
        if (existing.approved || !isRetryableRejection(reason)) {
          return {
            status: "skipped",
            reason,
            assetId: existing.id,
          }
        }
      }
    }

    const intent = await resolveNewsVisualIntent({
      title: story.title,
      summary: story.summary,
      body: story.body,
      category: story.category,
    })

    if (!intent) {
      const assetId = await upsertRejectedAsset(story, { rejectedReason: "no_intent" })
      return { status: "rejected", reason: "no_intent", assetId }
    }

    if (intent.confidence < MIN_AUTO_APPROVE_CONFIDENCE) {
      const assetId = await upsertRejectedAsset(story, {
        provider: "none",
        query: intent.query,
        negativeTerms: intent.negativeTerms,
        topicLabel: intent.label,
        confidence: intent.confidence,
        visualIntent: intent.reason ?? intent.query,
        rejectedReason: "low_confidence",
      })
      return { status: "rejected", reason: "low_confidence", assetId }
    }

    const stock = await findContextualStockPhoto({
      title: story.title,
      summary: story.summary,
      body: story.body,
      category: story.category,
    })

    if (!stock) {
      const assetId = await upsertRejectedAsset(story, {
        provider: "pexels",
        query: intent.query,
        negativeTerms: intent.negativeTerms,
        topicLabel: intent.label,
        confidence: intent.confidence,
        visualIntent: intent.reason ?? intent.query,
        rejectedReason: "no_stock_match",
      })
      return { status: "rejected", reason: "no_stock_match", assetId }
    }

    const storage = await uploadNewsImageWithDiagnostics(stock.url)
    if (!storage.url) {
      const rejectedReason = `storage_${storage.reason ?? "failed"}`
      const assetId = await upsertRejectedAsset(story, {
        provider: stock.provider,
        query: stock.query ?? intent.query,
        negativeTerms: intent.negativeTerms,
        topicLabel: stock.conceptLabel ?? intent.label,
        confidence: intent.confidence,
        visualIntent: intent.reason ?? intent.query,
        rejectedReason,
      })
      return { status: "rejected", reason: rejectedReason, assetId }
    }

    const asset = await prisma.newsImageAsset.upsert({
      where: {
        newsStoryId_variant: {
          newsStoryId: story.id,
          variant: DISCOVERY_V4_IMAGE_VARIANT,
        },
      },
      create: {
        newsStoryId: story.id,
        variant: DISCOVERY_V4_IMAGE_VARIANT,
        provider: stock.provider,
        sourceUrl: stock.url,
        storageUrl: storage.url,
        credit: stock.credit,
        licenseUrl: stock.licenseUrl,
        visualIntent: stock.intent?.reason ?? stock.intent?.query ?? stock.query ?? intent.query,
        query: stock.query ?? intent.query,
        negativeTerms: asJsonArray(stock.intent?.negativeTerms ?? intent.negativeTerms),
        topicLabel: stock.conceptLabel ?? stock.intent?.label ?? intent.label,
        category: normalizeCategory(story.category),
        confidence: stock.intent?.confidence ?? intent.confidence,
        qualityScore: stock.intent?.confidence ?? intent.confidence,
        approved: true,
        rejectedReason: null,
      },
      update: {
        provider: stock.provider,
        sourceUrl: stock.url,
        storageUrl: storage.url,
        credit: stock.credit,
        licenseUrl: stock.licenseUrl,
        visualIntent: stock.intent?.reason ?? stock.intent?.query ?? stock.query ?? intent.query,
        query: stock.query ?? intent.query,
        negativeTerms: asJsonArray(stock.intent?.negativeTerms ?? intent.negativeTerms),
        topicLabel: stock.conceptLabel ?? stock.intent?.label ?? intent.label,
        category: normalizeCategory(story.category),
        confidence: stock.intent?.confidence ?? intent.confidence,
        qualityScore: stock.intent?.confidence ?? intent.confidence,
        approved: true,
        rejectedReason: null,
      },
    })

    return { status: "updated", assetId: asset.id }
  } catch (err) {
    console.error("[news-image-assets] prepare failed:", err)
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "unknown_error",
    }
  }
}
