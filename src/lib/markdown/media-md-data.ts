import { prisma } from "@/lib/prisma"
import { parseMediaRouteId, isPublicMedia, type MediaType } from "@/lib/media-route"
import type { MediaMdInput } from "@/lib/markdown/media-md"

// Shared fiche loader for the markdown surfaces: the /md/media/[id] route and
// the MCP get_age_verdict tool resolve identifiers and shape the render input
// through this single function, so both always describe the same fiche the
// same way (public-visibility gate included).

/**
 * Resolves a media identifier — a routeId ("movie:abc123"), a raw DB id, or a
 * TMDB/IGDB numeric id — to the markdown render input. Returns null when the
 * item doesn't exist or isn't publicly visible.
 */
export async function loadMediaMdInput(routeIdOrRaw: string): Promise<MediaMdInput | null> {
  const { id: rawId } = parseMediaRouteId(routeIdOrRaw)

  let dbMedia = await prisma.mediaItem.findUnique({
    where: { id: rawId },
    include: { contentMetrics: true },
  })

  if (!dbMedia) {
    const numericId = parseInt(rawId)
    if (!Number.isNaN(numericId)) {
      dbMedia =
        (await prisma.mediaItem.findFirst({
          where: { tmdbId: numericId },
          include: { contentMetrics: true },
        })) ||
        (await prisma.mediaItem.findFirst({
          where: { igdbId: numericId },
          include: { contentMetrics: true },
        }))
    }
  }

  if (!dbMedia) return null

  if (
    !isPublicMedia({
      posterUrl: dbMedia.posterUrl,
      dataQualityScore: dbMedia.dataQualityScore,
      type: dbMedia.type as MediaType,
    })
  ) {
    return null
  }

  const metrics = dbMedia.contentMetrics
  return {
    id: dbMedia.id,
    title: dbMedia.title,
    type: dbMedia.type as MediaType,
    expertAgeRec: dbMedia.expertAgeRec,
    officialRating: dbMedia.officialRating,
    originalLanguage: (dbMedia as unknown as { originalLanguage?: string | null }).originalLanguage ?? null,
    releaseDate: dbMedia.releaseDate?.toISOString().split("T")[0] || null,
    isEnriched: dbMedia.isEnriched,
    releaseStatus: (dbMedia as unknown as { releaseStatus?: string | null }).releaseStatus ?? null,
    updatedAt: dbMedia.updatedAt,
    topics: dbMedia.topics || [],
    genres: dbMedia.genres || [],
    contentMetrics: metrics
      ? {
          violence: metrics.violence,
          sexNudity: metrics.sexNudity,
          language: metrics.language,
          consumerism: metrics.consumerism,
          substanceUse: metrics.substanceUse,
          positiveMessages: metrics.positiveMessages,
          roleModels: metrics.roleModels,
          whatParentsNeedToKnow: metrics.whatParentsNeedToKnow || [],
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
        },
  }
}
