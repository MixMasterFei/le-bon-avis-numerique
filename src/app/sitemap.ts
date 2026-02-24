import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { toMediaRouteId } from "@/lib/media-route"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
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

  // Dynamic media pages — only enriched items with posters
  let mediaPages: MetadataRoute.Sitemap = []
  try {
    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        posterUrl: { not: null },
        contentMetrics: { isNot: null },
      },
      select: {
        id: true,
        type: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })

    mediaPages = mediaItems.map((item) => ({
      url: `${baseUrl}/media/${toMediaRouteId(item.type, item.id)}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch {
    // DB unavailable at build time — return static pages only
  }

  return [...staticPages, ...mediaPages]
}
