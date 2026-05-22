import { Prisma, type NewsCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { findContextualStockPhoto } from "@/lib/stock-photo"
import { resolveNewsVisualIntent } from "@/lib/news-visual-intent"
import { editorialVisualCard } from "@/lib/news-image"
import { ensureOfficialPressAssetForStory } from "@/lib/official-press-assets"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"
import { extractCatalogMatchesFromStory, loadCatalogIndex } from "@/lib/news-linkify"

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
  relatedMediaId?: string | null
  relatedMediaIds?: string[] | null
}

export interface PrepareV4ImageResult {
  status: "updated" | "skipped" | "rejected" | "error"
  reason?: string
  assetId?: string
}

function normalizeCategory(category: NewsCategory | string): NewsCategory {
  return category as NewsCategory
}

export function primaryRelatedMediaId(story: {
  relatedMediaId?: string | null
  relatedMediaIds?: string[] | null
}): string | null {
  if (story.relatedMediaIds && story.relatedMediaIds.length > 0) {
    return story.relatedMediaIds[0] ?? null
  }
  return story.relatedMediaId ?? null
}

const CATALOG_POSTER_CREDIT = "Totem Avisé / Catalogue"

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

async function upsertApprovedAsset(
  story: V4ImageStoryInput,
  data: {
    provider: string
    sourceUrl: string
    storageUrl: string
    credit: string | null
    licenseUrl?: string | null
    visualIntent: string
    query: string
    negativeTerms?: string[]
    topicLabel?: string
    confidence: number
    qualityScore?: number | null
  },
): Promise<string> {
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
      provider: data.provider,
      sourceUrl: data.sourceUrl,
      storageUrl: data.storageUrl,
      credit: data.credit,
      licenseUrl: data.licenseUrl ?? null,
      visualIntent: data.visualIntent,
      query: data.query,
      negativeTerms: asJsonArray(data.negativeTerms ?? []),
      topicLabel: data.topicLabel,
      category: normalizeCategory(story.category),
      confidence: data.confidence,
      qualityScore: data.qualityScore ?? data.confidence,
      approved: true,
      rejectedReason: null,
    },
    update: {
      provider: data.provider,
      sourceUrl: data.sourceUrl,
      storageUrl: data.storageUrl,
      credit: data.credit,
      licenseUrl: data.licenseUrl ?? null,
      visualIntent: data.visualIntent,
      query: data.query,
      negativeTerms: asJsonArray(data.negativeTerms ?? []),
      topicLabel: data.topicLabel,
      category: normalizeCategory(story.category),
      confidence: data.confidence,
      qualityScore: data.qualityScore ?? data.confidence,
      approved: true,
      rejectedReason: null,
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

export async function batchLoadApprovedDiscoveryV4Images(
  storyIds: string[],
): Promise<Map<string, PreparedNewsImage>> {
  const uniqueIds = [...new Set(storyIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  try {
    const rows = await prisma.newsImageAsset.findMany({
      where: {
        newsStoryId: { in: uniqueIds },
        variant: DISCOVERY_V4_IMAGE_VARIANT,
        approved: true,
        storageUrl: { not: null },
      },
      select: {
        newsStoryId: true,
        storageUrl: true,
        credit: true,
        licenseUrl: true,
      },
    })

    const map = new Map<string, PreparedNewsImage>()
    for (const row of rows) {
      if (!row.storageUrl) continue
      map.set(row.newsStoryId, {
        url: row.storageUrl,
        credit: row.credit,
        licenseUrl: row.licenseUrl,
      })
    }
    return map
  } catch (err) {
    console.warn("[news-image-assets] batch read failed:", err)
    return new Map()
  }
}

/**
 * Title-based catalog match for stories missing relatedMediaId.
 * Uses the same deterministic linkifier as reverify-related, but
 * without LLM subject terms — exact title mentions only.
 */
export async function batchResolveCatalogPostersByTitle(
  stories: V4ImageStoryInput[],
): Promise<Map<string, PreparedNewsImage>> {
  const needsMatch = stories.filter((story) => !primaryRelatedMediaId(story))
  if (needsMatch.length === 0) return new Map()

  try {
    const catalog = await loadCatalogIndex()
    if (catalog.length === 0) return new Map()

    const storyToMediaId = new Map<string, string>()
    for (const story of needsMatch) {
      const matches = extractCatalogMatchesFromStory(
        {
          title: story.title,
          summary: story.summary,
          body: story.body ?? "",
        },
        catalog,
        1,
      )
      const mediaId = matches[0]
      if (mediaId) storyToMediaId.set(story.id, mediaId)
    }

    const posterMap = await batchLoadCatalogPosters([...storyToMediaId.values()])
    const result = new Map<string, PreparedNewsImage>()
    for (const [storyId, mediaId] of storyToMediaId) {
      const poster = posterMap.get(mediaId)
      if (poster) result.set(storyId, poster)
    }
    return result
  } catch (err) {
    console.warn("[news-image-assets] title catalog batch failed:", err)
    return new Map()
  }
}

export async function batchLoadCatalogPosters(
  mediaIds: string[],
): Promise<Map<string, PreparedNewsImage>> {
  const uniqueIds = [...new Set(mediaIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  try {
    const rows = await prisma.mediaItem.findMany({
      where: { id: { in: uniqueIds }, posterUrl: { not: null } },
      select: { id: true, posterUrl: true, title: true },
    })

    const map = new Map<string, PreparedNewsImage>()
    for (const row of rows) {
      if (!row.posterUrl) continue
      map.set(row.id, {
        url: row.posterUrl,
        credit: CATALOG_POSTER_CREDIT,
        licenseUrl: null,
      })
    }
    return map
  } catch (err) {
    console.warn("[news-image-assets] catalog poster batch failed:", err)
    return new Map()
  }
}

async function resolveCatalogPosterByMediaId(
  story: V4ImageStoryInput,
  mediaId: string,
): Promise<{ image: PreparedNewsImage; assetId: string } | null> {

  try {
    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
      select: { id: true, posterUrl: true, title: true },
    })
    if (!media?.posterUrl) return null

    const storage = await uploadNewsImageWithDiagnostics(media.posterUrl)
    const storageUrl = storage.url ?? media.posterUrl

    const assetId = await upsertApprovedAsset(story, {
      provider: "catalog_poster",
      sourceUrl: media.posterUrl,
      storageUrl,
      credit: CATALOG_POSTER_CREDIT,
      licenseUrl: null,
      visualIntent: `catalog poster: ${media.title}`,
      query: media.title,
      topicLabel: media.title,
      confidence: 0.99,
      qualityScore: 0.99,
    })

    return {
      image: {
        url: storageUrl,
        credit: CATALOG_POSTER_CREDIT,
        licenseUrl: null,
      },
      assetId,
    }
  } catch (err) {
    console.warn("[news-image-assets] catalog poster failed:", err)
    return null
  }
}

export async function resolveCatalogPosterForStory(
  story: V4ImageStoryInput,
): Promise<{ image: PreparedNewsImage; assetId: string } | null> {
  const relatedId = primaryRelatedMediaId(story)
  if (relatedId) {
    return resolveCatalogPosterByMediaId(story, relatedId)
  }

  try {
    const catalog = await loadCatalogIndex()
    const matches = extractCatalogMatchesFromStory(
      {
        title: story.title,
        summary: story.summary,
        body: story.body ?? "",
      },
      catalog,
      1,
    )
    const mediaId = matches?.[0]
    if (!mediaId) return null
    return resolveCatalogPosterByMediaId(story, mediaId)
  } catch (err) {
    console.warn("[news-image-assets] title catalog poster failed:", err)
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
        select: { id: true, approved: true, provider: true, rejectedReason: true },
      })
      if (existing) {
        const reason = existing.approved ? "already_prepared" : existing.rejectedReason ?? "already_rejected"
        const shouldRetryExistingTotemFallback = existing.approved && existing.provider === "totem_editorial"
        if (!shouldRetryExistingTotemFallback && (existing.approved || !isRetryableRejection(reason))) {
          return {
            status: "skipped",
            reason,
            assetId: existing.id,
          }
        }
      }
    }

    const catalogPoster = await resolveCatalogPosterForStory(story)
    if (catalogPoster) {
      return { status: "updated", reason: "catalog_poster", assetId: catalogPoster.assetId }
    }

    const officialPress = await ensureOfficialPressAssetForStory(story)
    if (officialPress) {
      const assetId = await upsertApprovedAsset(story, {
        provider: "official_press",
        sourceUrl: officialPress.sourceUrl,
        storageUrl: officialPress.url,
        credit: officialPress.credit,
        licenseUrl: officialPress.licenseUrl,
        visualIntent: `official press asset: ${officialPress.title}`,
        query: officialPress.tags.join(" ") || story.title,
        topicLabel: officialPress.brand,
        confidence: 0.98,
        qualityScore: 0.98,
      })
      return { status: "updated", reason: "official_press", assetId }
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

    const editorialVisual = editorialVisualCard(story)
    const stock = await findContextualStockPhoto({
      title: story.title,
      summary: story.summary,
      body: story.body,
      category: story.category,
    })

    if (!stock) {
      if (editorialVisual) {
        const assetId = await upsertApprovedAsset(story, {
          provider: "totem_editorial",
          sourceUrl: editorialVisual.url,
          storageUrl: editorialVisual.url,
          credit: editorialVisual.credit,
          licenseUrl: editorialVisual.licenseUrl,
          visualIntent: editorialVisual.auditLabel ?? "editorial brand visual",
          query: story.title,
          topicLabel: editorialVisual.auditLabel ?? "editorial brand visual",
          confidence: 0.95,
          qualityScore: 0.95,
        })
        return { status: "updated", reason: "editorial_visual", assetId }
      }

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
      const storageReason = `storage_${storage.reason ?? "failed"}`
      const assetId = await upsertApprovedAsset(story, {
        provider: stock.provider,
        sourceUrl: stock.url,
        storageUrl: stock.url,
        credit: stock.credit,
        licenseUrl: stock.licenseUrl,
        query: stock.query ?? intent.query,
        negativeTerms: intent.negativeTerms,
        topicLabel: stock.conceptLabel ?? intent.label,
        confidence: intent.confidence,
        visualIntent: intent.reason ?? intent.query,
      })
      return { status: "updated", reason: `${storageReason}_using_source`, assetId }
    }

    const assetId = await upsertApprovedAsset(story, {
      provider: stock.provider,
      sourceUrl: stock.url,
      storageUrl: storage.url,
      credit: stock.credit,
      licenseUrl: stock.licenseUrl,
      visualIntent: stock.intent?.reason ?? stock.intent?.query ?? stock.query ?? intent.query,
      query: stock.query ?? intent.query,
      negativeTerms: stock.intent?.negativeTerms ?? intent.negativeTerms,
      topicLabel: stock.conceptLabel ?? stock.intent?.label ?? intent.label,
      confidence: stock.intent?.confidence ?? intent.confidence,
      qualityScore: stock.intent?.confidence ?? intent.confidence,
    })

    return { status: "updated", assetId }
  } catch (err) {
    console.error("[news-image-assets] prepare failed:", err)
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "unknown_error",
    }
  }
}
