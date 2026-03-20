import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { toMediaRouteId } from "@/lib/media-route"

const ITEMS_PER_SITEMAP = 1000
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

/**
 * Tell Next.js how many sitemap chunks exist.
 * Chunk 0 = static pages, chunks 1+ = media pages (1,000 each).
 */
export async function generateSitemaps() {
  let mediaCount = 0
  try {
    mediaCount = await prisma.mediaItem.count({
      where: { posterUrl: { not: null }, dataQualityScore: { gte: 30 } },
    })
  } catch {
    // DB unreachable at build time — at least produce the static chunk
  }

  const mediaChunks = Math.max(1, Math.ceil(mediaCount / ITEMS_PER_SITEMAP))
  // chunk 0 = static, chunks 1..N = media
  return Array.from({ length: 1 + mediaChunks }, (_, i) => ({ id: i }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  // Chunk 0 — static pages
  if (id === 0) {
    return [
      { url: baseUrl, changeFrequency: "daily", priority: 1 },
      { url: `${baseUrl}/films`, changeFrequency: "daily", priority: 0.9 },
      { url: `${baseUrl}/series`, changeFrequency: "daily", priority: 0.9 },
      { url: `${baseUrl}/jeux`, changeFrequency: "daily", priority: 0.9 },
      { url: `${baseUrl}/livres`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${baseUrl}/collections`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/recommandations`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/recherche`, changeFrequency: "weekly", priority: 0.6 },
      { url: `${baseUrl}/guides`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${baseUrl}/a-propos`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${baseUrl}/objectif`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${baseUrl}/nos-valeurs`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.3 },
      // Age range pages
      { url: `${baseUrl}/age/2-4`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/age/5-7`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/age/8-10`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/age/11-12`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/age/13-15`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${baseUrl}/age/16-plus`, changeFrequency: "weekly", priority: 0.8 },
    ]
  }

  // Chunks 1..N — media pages (1,000 per chunk)
  const mediaChunkIndex = id - 1
  try {
    const mediaItems = await prisma.mediaItem.findMany({
      where: { posterUrl: { not: null }, dataQualityScore: { gte: 30 } },
      select: { id: true, type: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      skip: mediaChunkIndex * ITEMS_PER_SITEMAP,
      take: ITEMS_PER_SITEMAP,
    })

    return mediaItems.map((item) => ({
      url: `${baseUrl}/media/${toMediaRouteId(item.type, item.id)}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error("[sitemap] DB query failed:", error instanceof Error ? error.message : error)
    return []
  }
}
