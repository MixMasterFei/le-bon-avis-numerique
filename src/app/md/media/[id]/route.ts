import { prisma } from "@/lib/prisma"
import {
  parseMediaRouteId,
  toMediaRouteId,
  isPublicMedia,
  type MediaType,
} from "@/lib/media-route"
import { renderMediaMarkdown, type MediaMdInput } from "@/lib/markdown/media-md"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 3600

interface RouteParams {
  params: Promise<{ id: string }>
}

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
    },
  })
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const { id: rawId } = parseMediaRouteId(id)

  let dbMedia
  try {
    dbMedia = await prisma.mediaItem.findUnique({
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
  } catch (error) {
    console.error("[md/media] DB query failed:", error instanceof Error ? error.message : error)
    return notFoundResponse()
  }

  if (!dbMedia) return notFoundResponse()

  if (
    !isPublicMedia({
      posterUrl: dbMedia.posterUrl,
      dataQualityScore: dbMedia.dataQualityScore,
      type: dbMedia.type as MediaType,
    })
  ) {
    return notFoundResponse()
  }

  const metrics = dbMedia.contentMetrics
  const input: MediaMdInput = {
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

  const body = renderMediaMarkdown(input)
  const canonicalRouteId = toMediaRouteId(dbMedia.type as MediaType, dbMedia.id)
  const canonical = `${baseUrl}/media/${canonicalRouteId}`

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Link": `<${canonical}>; rel="canonical"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
