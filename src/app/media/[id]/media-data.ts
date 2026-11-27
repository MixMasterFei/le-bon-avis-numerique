/**
 * Fiche data for /media/[id] — shared by the segment layout (which answers a
 * real 404 for a missing fiche before anything streams) and page.tsx.
 */
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { MediaItem as MockMediaItem, MediaType } from "@/lib/types"

// Extended type for database items with screenshots
export interface DatabaseMediaItem extends MockMediaItem {
  /** Last change to the public content — age, synopsis or content analysis
   *  (ISO). JSON-LD dateModified + visible fiche date. Deliberately NOT the
   *  row's updatedAt, which any bookkeeping write moves. */
  contentUpdatedAt?: string | null
  /** Enriched, with a stored content analysis (not the all-zero placeholder). */
  hasContentAnalysis?: boolean
  numberOfSeasons?: number | null
  pegiDescriptors?: string[]
  gameModes?: string[]
  // Manga-specific (only set when type === "MANGA")
  volumeCount?: number | null
  chapterCount?: number | null
  demographic?: string | null
  status?: string | null
  screenshots?: { id: string; url: string; width: number | null; height: number | null; order: number }[]
}

// Helper to fetch from database directly (cached to avoid duplicate queries in generateMetadata + page)
// UUID v4 regex (case-insensitive)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pure integer regex (no leading zeros except for "0" itself)
const PURE_INTEGER_REGEX = /^(0|[1-9]\d*)$/

// Looks like a UUID prefix (8+ hex chars, possibly with hyphens)
const UUID_PREFIX_REGEX = /^[0-9a-f]{8,}(-[0-9a-f]*)*$/i

function isFullUuid(s: string): boolean {
  return UUID_REGEX.test(s)
}

export function isPureInteger(s: string): boolean {
  return PURE_INTEGER_REGEX.test(s)
}

function isUuidPrefix(s: string): boolean {
  return UUID_PREFIX_REGEX.test(s) && !isFullUuid(s)
}

async function readMedia(
  id: string,
  expectedType?: MediaType | null
): Promise<DatabaseMediaItem | null> {
  try {
    // Common include configuration - simplified to avoid potential schema mismatches
    const includeConfig = {
      contentMetrics: true,
      screenshots: {
        orderBy: { order: "asc" as const },
        take: 12, // Fetch extra to account for dedup (language variants)
      },
      reviews: {
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
      // The true review total — `reviews` above is capped for display.
      _count: { select: { reviews: true } },
    }

    let dbMedia = null

    // 1. Try exact UUID match
    if (isFullUuid(id)) {
      dbMedia = await prisma.mediaItem.findUnique({
        where: { id },
        include: includeConfig,
      })
    }
    // 2. If it looks like a UUID prefix (hex chars), try prefix match
    else if (isUuidPrefix(id)) {
      // Normalize: remove hyphens for prefix search, then search with LIKE
      const normalizedPrefix = id.replace(/-/g, "").toLowerCase()
      // Build the UUID prefix pattern (re-insert hyphens at standard positions)
      // UUID format: 8-4-4-4-12 = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      let likePattern = normalizedPrefix
      // If prefix is longer than 8, we need to account for the first hyphen position
      if (normalizedPrefix.length > 8) {
        likePattern = normalizedPrefix.slice(0, 8) + "-" + normalizedPrefix.slice(8)
      }
      if (normalizedPrefix.length > 12) {
        likePattern = likePattern.slice(0, 13) + "-" + likePattern.slice(13)
      }
      if (normalizedPrefix.length > 16) {
        likePattern = likePattern.slice(0, 18) + "-" + likePattern.slice(18)
      }
      if (normalizedPrefix.length > 20) {
        likePattern = likePattern.slice(0, 23) + "-" + likePattern.slice(23)
      }

      // Build the where clause with optional type filter
      const whereClause: { id: { startsWith: string }; type?: MediaType } = {
        id: { startsWith: likePattern },
      }
      if (expectedType) {
        whereClause.type = expectedType
      }

      // Find all matches
      const matches = await prisma.mediaItem.findMany({
        where: whereClause,
        include: includeConfig,
        take: 2, // We only need to know if there's 0, 1, or >1 matches
      })

      if (matches.length === 1) {
        dbMedia = matches[0]
      } else if (matches.length > 1) {
        // Ambiguous prefix - return null (will 404)
        return null
      }
      // If 0 matches with type filter, try without type to see if it exists with wrong type
      // (this will be caught by type validation below and 404)
      if (!dbMedia && expectedType) {
        const anyMatch = await prisma.mediaItem.findFirst({
          where: { id: { startsWith: likePattern } },
          include: includeConfig,
        })
        if (anyMatch) {
          // Found with different type - return it so the type check below can 404
          dbMedia = anyMatch
        }
      }
    }
    // 3. Only try numeric ID lookup if it's a PURE integer (not hex that starts with digits)
    else if (isPureInteger(id)) {
      const numericId = parseInt(id, 10)

      // Try tmdbId first (movies/TV)
      if (!expectedType || expectedType === "MOVIE" || expectedType === "TV") {
        dbMedia = await prisma.mediaItem.findFirst({
          where: {
            tmdbId: numericId,
            ...(expectedType ? { type: expectedType } : {}),
          },
          include: includeConfig,
        })
      }

      // Try igdbId (games)
      if (!dbMedia && (!expectedType || expectedType === "GAME")) {
        dbMedia = await prisma.mediaItem.findFirst({
          where: {
            igdbId: numericId,
            ...(expectedType ? { type: expectedType } : {}),
          },
          include: includeConfig,
        })
      }
    }

    if (!dbMedia) return null

    // Type validation: if URL specified a type, the found media must match
    if (expectedType && dbMedia.type !== expectedType) {
      return null
    }

    // First-party star ratings over ALL of the fiche's reviews, not just the
    // 10 loaded for display — they feed the JSON-LD AggregateRating, which
    // must neither under-count nor sample. A failed average only drops the
    // rating markup; it never takes the fiche down with it.
    const reviewCount = dbMedia._count.reviews
    const reviewAvgRating =
      reviewCount > 0
        ? await prisma.review
            .aggregate({ where: { mediaId: dbMedia.id }, _avg: { rating: true } })
            .then((agg) => agg._avg.rating)
            .catch(() => null)
        : null

    return {
      id: dbMedia.id,
      title: dbMedia.title,
      originalTitle: dbMedia.originalTitle || undefined,
      type: dbMedia.type as MockMediaItem["type"],
      releaseDate: dbMedia.releaseDate?.toISOString().split("T")[0] || null,
      releaseStatus: dbMedia.releaseStatus,
      contentUpdatedAt: dbMedia.contentUpdatedAt?.toISOString() ?? null,
      seoTitle: dbMedia.seoTitle,
      posterUrl: dbMedia.posterUrl || "/placeholder-poster.jpg",
      synopsisFr: dbMedia.synopsisFr,
      officialRating: dbMedia.officialRating,
      pegiDescriptors: dbMedia.pegiDescriptors ?? [],
      expertAgeRec: dbMedia.expertAgeRec,
      // Imported with an estimated age but not yet AI-enriched → "âge provisoire".
      isProvisional: !dbMedia.isEnriched && dbMedia.expertAgeRec != null,
      // An enriched fiche with a real content_metrics row — the analysis the
      // meta description may quote (all-zero defaults below are not one).
      hasContentAnalysis: !!dbMedia.isEnriched && !!dbMedia.contentMetrics,
      communityAgeRec: dbMedia.communityAgeRec,
      reviewCount,
      reviewAvgRating,
      duration: dbMedia.duration || undefined,
      director: dbMedia.director || undefined,
      genres: dbMedia.genres || [],
      platforms: dbMedia.platforms || [],
      topics: dbMedia.topics || [],
      numberOfSeasons: (dbMedia as unknown as { numberOfSeasons?: number | null }).numberOfSeasons ?? null,
      // Read by the « À lire aussi » blog link (fear tone, @/lib/blog-links).
      toneTags: dbMedia.contentMetrics?.toneTags ?? [],
      contentMetrics: dbMedia.contentMetrics
        ? {
            violence: dbMedia.contentMetrics.violence,
            sexNudity: dbMedia.contentMetrics.sexNudity,
            language: dbMedia.contentMetrics.language,
            consumerism: dbMedia.contentMetrics.consumerism,
            substanceUse: dbMedia.contentMetrics.substanceUse,
            positiveMessages: dbMedia.contentMetrics.positiveMessages,
            roleModels: dbMedia.contentMetrics.roleModels,
            whatParentsNeedToKnow: dbMedia.contentMetrics.whatParentsNeedToKnow || [],
            sensitiveWarnings: dbMedia.contentMetrics.sensitiveWarnings || [],
            enrichmentConfidence: dbMedia.contentMetrics.enrichmentConfidence,
          }
        : {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
            sensitiveWarnings: [],
            enrichmentConfidence: null,
          },
      reviews: dbMedia.reviews.map((r) => {
        const ext = r as unknown as { editedAt?: Date; familyMember?: { id: string; name: string; avatarEmoji?: string } }
        return {
          id: r.id,
          role: r.role as "PARENT" | "KID" | "EDUCATOR",
          rating: r.rating,
          ageSuggestion: r.ageSuggestion ?? 0,
          comment: r.comment || "",
          createdAt: r.createdAt.toISOString(),
          editedAt: ext.editedAt?.toISOString() || null,
          user: r.user ? { id: r.user.id, name: r.user.name, image: r.user.image } : undefined,
          familyMember: ext.familyMember ? { id: ext.familyMember.id, name: ext.familyMember.name, avatarEmoji: ext.familyMember.avatarEmoji } : null,
        }
      }),
      screenshots: dbMedia.screenshots?.map((s) => ({
        id: s.id,
        url: s.url,
        width: s.width,
        height: s.height,
        order: s.order,
      })) || [],
      volumeCount: (dbMedia as unknown as { volumeCount?: number | null }).volumeCount ?? null,
      chapterCount: (dbMedia as unknown as { chapterCount?: number | null }).chapterCount ?? null,
      demographic: (dbMedia as unknown as { demographic?: string | null }).demographic ?? null,
      status: (dbMedia as unknown as { status?: string | null }).status ?? null,
    }
  } catch (error) {
    console.error("Failed to fetch from database:", error)
    throw error
  }
}

/**
 * The fiche lookup, cached per request so the [id] layout, generateMetadata
 * and the page share ONE query. It tells « no such fiche » (`media: null`)
 * apart from « the database failed » (`failed: true`): only the first may
 * become a 404 — a database blip answering 404 on every fiche would tell
 * Google to drop the whole catalogue.
 */
export const lookupMedia = cache(async function lookupMedia(
  id: string,
  expectedType?: MediaType | null,
): Promise<{ media: DatabaseMediaItem | null; failed: boolean; error?: unknown }> {
  try {
    return { media: await readMedia(id, expectedType), failed: false }
  } catch (error) {
    return { media: null, failed: true, error }
  }
})

/** The page's historical contract: the fiche, or null (absent OR unreadable). */
export async function fetchFromDatabase(
  id: string,
  expectedType?: MediaType | null,
): Promise<DatabaseMediaItem | null> {
  const result = await lookupMedia(id, expectedType)
  // Re-throw in development to see the actual error
  if (result.failed && process.env.NODE_ENV === "development") throw result.error
  return result.media
}
