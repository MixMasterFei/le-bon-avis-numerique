import { prisma } from "@/lib/prisma"
import { parseMediaRouteId, publicMediaWhere, type MediaType } from "@/lib/media-route"
import { withPrismaRetry } from "@/lib/prisma-retry"
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
  let decoded: string
  try { decoded = decodeURIComponent(routeIdOrRaw.trim()) } catch { return null }
  const { type, id: rawId } = parseMediaRouteId(decoded)
  if (decoded.includes(":") && !type) return null
  if (type === "MANGA") return null
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
  const numeric = /^[1-9]\d*$/.test(rawId) && Number(rawId) <= 2147483647
  // Provider IDs only have meaning within their namespace. Never try TMDB
  // first for a game, or turn a malformed UUID/"603oops" into a numeric ID.
  if (!uuid && !(numeric && (type === "MOVIE" || type === "TV" || type === "GAME"))) return null
  const identifier = uuid ? { id: rawId } : type === "GAME" ? { igdbId: Number(rawId) } : { tmdbId: Number(rawId) }
  const dbMedia = await withPrismaRetry(() => prisma.mediaItem.findFirst({
    where: { ...publicMediaWhere, ...identifier, ...(type ? { type } : {}) },
    include: { contentMetrics: true },
  }))
  if (!dbMedia) return null

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
    hasContentAnalysis: metrics !== null,
    assessmentSource: metrics?.enrichmentSource ?? null,
    assessedAt: metrics?.pass2At ?? metrics?.pass1At ?? null,
    assessmentConfidence: metrics?.enrichmentConfidence ?? null,
    sensitiveWarnings: metrics?.sensitiveWarnings ?? [],
    sensitiveWarningsAt: metrics?.sensitiveWarningsAt ?? null,
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
