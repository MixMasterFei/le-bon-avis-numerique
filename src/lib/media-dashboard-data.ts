import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { MediaType } from "@/lib/media-route"

export interface DashboardReview {
  id: string
  role: "PARENT" | "KID" | "EDUCATOR"
  rating: number
  ageSuggestion: number
  comment: string
  createdAt?: string
  editedAt?: string | null
  user?: { id: string; name: string | null; image: string | null }
  familyMember?: { id: string; name: string; avatarEmoji: string } | null
}

/**
 * Focused data fetch for the V3 dashboard fiche (`/media/[id]/apercu`).
 *
 * Deliberately DB-only and lighter than the classic page's `fetchFromDatabase`
 * (no external-API / mock fallback): the dashboard is an admin preview surface,
 * so off-catalog titles simply fall through to the classic page. Everything the
 * scoreboard needs comes from the row + its ContentMetrics + screenshots;
 * family-fit, watch providers and similar titles are fetched by their own
 * client components (by mediaId).
 */
export interface DashboardMedia {
  id: string
  title: string
  originalTitle: string | null
  type: MediaType
  releaseDate: string | null
  releaseStatus: string | null
  /** Last data update (ISO) — shown as « Fiche mise à jour le … » and
   *  emitted as JSON-LD dateModified (trust + AI-citability signal). */
  updatedAt: string | null
  posterUrl: string | null
  synopsisFr: string | null
  officialRating: string | null
  expertAgeRec: number | null
  communityAgeRec: number | null
  isProvisional: boolean
  duration: number | null
  director: string | null
  genres: string[]
  platforms: string[]
  pegiDescriptors: string[]
  topics: string[]
  numberOfSeasons: number | null
  metrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
    sensitiveWarnings: string[]
    enrichmentConfidence: number | null
  } | null
  screenshots: { id: string; url: string; width: number | null; height: number | null; order: number }[]
  reviews: DashboardReview[]
  reviewCount: number
}

export const getDashboardMedia = cache(async function getDashboardMedia(
  rawId: string,
): Promise<DashboardMedia | null> {
  try {
    const include = {
      contentMetrics: true,
      // Over-fetch: the same frame is often stored as several language
      // variants, deduped by URL at render — mirrors the classic fiche.
      screenshots: { orderBy: { order: "asc" as const }, take: 12 },
      reviews: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
      _count: { select: { reviews: true } },
    }

    let row = await prisma.mediaItem.findUnique({ where: { id: rawId }, include })

    if (!row) {
      const numericId = parseInt(rawId)
      if (!isNaN(numericId)) {
        row =
          (await prisma.mediaItem.findFirst({ where: { tmdbId: numericId }, include })) ??
          (await prisma.mediaItem.findFirst({ where: { igdbId: numericId }, include }))
      }
    }

    if (!row) return null

    const cm = row.contentMetrics
    return {
      id: row.id,
      title: row.title,
      originalTitle: row.originalTitle,
      type: row.type as MediaType,
      releaseDate: row.releaseDate?.toISOString().split("T")[0] ?? null,
      releaseStatus: row.releaseStatus,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      posterUrl: row.posterUrl,
      synopsisFr: row.synopsisFr,
      officialRating: row.officialRating,
      expertAgeRec: row.expertAgeRec,
      communityAgeRec: row.communityAgeRec,
      // Imported with an estimated age but not yet AI-enriched → provisional.
      isProvisional: !row.isEnriched && row.expertAgeRec != null,
      duration: row.duration,
      director: row.director,
      genres: row.genres ?? [],
      platforms: row.platforms ?? [],
      pegiDescriptors: row.pegiDescriptors ?? [],
      topics: row.topics ?? [],
      numberOfSeasons: (row as unknown as { numberOfSeasons?: number | null }).numberOfSeasons ?? null,
      metrics: cm
        ? {
            violence: cm.violence,
            sexNudity: cm.sexNudity,
            language: cm.language,
            consumerism: cm.consumerism,
            substanceUse: cm.substanceUse,
            positiveMessages: cm.positiveMessages,
            roleModels: cm.roleModels,
            whatParentsNeedToKnow: cm.whatParentsNeedToKnow ?? [],
            sensitiveWarnings: cm.sensitiveWarnings ?? [],
            enrichmentConfidence: cm.enrichmentConfidence,
          }
        : null,
      screenshots:
        row.screenshots?.map((s) => ({
          id: s.id,
          url: s.url,
          width: s.width,
          height: s.height,
          order: s.order,
        })) ?? [],
      reviews: (row.reviews ?? []).map((r) => {
        const ext = r as unknown as { editedAt?: Date }
        return {
          id: r.id,
          role: r.role as "PARENT" | "KID" | "EDUCATOR",
          rating: r.rating,
          ageSuggestion: r.ageSuggestion ?? 0,
          comment: r.comment ?? "",
          createdAt: r.createdAt.toISOString(),
          editedAt: ext.editedAt?.toISOString() ?? null,
          user: r.user ? { id: r.user.id, name: r.user.name, image: r.user.image } : undefined,
          familyMember: null,
        }
      }),
      reviewCount: (row as unknown as { _count?: { reviews: number } })._count?.reviews ?? 0,
    }
  } catch (error) {
    console.error("[getDashboardMedia] failed:", error)
    return null
  }
})
