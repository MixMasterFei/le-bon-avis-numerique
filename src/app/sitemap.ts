import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { toMediaRouteId } from "@/lib/media-route"
import { sanityClient } from "@/sanity/client"

// Revalidate sitemap every 6 hours (ISR) — picks up new cron imports
export const revalidate = 21600

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    { url: `${baseUrl}/notre-methode`, changeFrequency: "monthly", priority: 0.5 },
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

  // Media pages from database
  let mediaPages: MetadataRoute.Sitemap = []
  try {
    const mediaItems = await prisma.mediaItem.findMany({
      where: { posterUrl: { not: null }, dataQualityScore: { gte: 30 } },
      select: { id: true, type: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    })

    mediaPages = mediaItems.map((item) => ({
      url: `${baseUrl}/media/${toMediaRouteId(item.type, item.id)}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error("[sitemap] DB query failed:", error instanceof Error ? error.message : error)
  }

  // Blog posts from Sanity
  let blogPages: MetadataRoute.Sitemap = []
  try {
    const posts = await sanityClient.fetch<{ slug: string; publishedAt: string }[]>(
      `*[_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()]{ "slug": slug.current, publishedAt }`
    )
    blogPages = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
    // Add the blog listing page
    if (posts.length > 0) {
      blogPages.unshift({
        url: `${baseUrl}/blog`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error("[sitemap] Sanity query failed:", error instanceof Error ? error.message : error)
  }

  return [...staticPages, ...mediaPages, ...blogPages]
}
