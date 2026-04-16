import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { toMediaRouteId } from "@/lib/media-route"
import { sanityClient } from "@/sanity/client"

// Revalidate sitemap every 6 hours (ISR) — picks up new cron imports
export const revalidate = 21600

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/films`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/series`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/jeux`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/livres`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/recommandations`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/recherche`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/notre-methode`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/objectif`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/nos-valeurs`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    // Age range pages
    { url: `${baseUrl}/age/2-4`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/5-7`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/8-10`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/11-12`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/13-15`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/16-plus`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
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
    // Add the blog listing page (lastModified = newest published post)
    if (posts.length > 0) {
      const latestPostDate = new Date(
        posts.reduce((max, p) => (p.publishedAt > max ? p.publishedAt : max), posts[0].publishedAt)
      )
      blogPages.unshift({
        url: `${baseUrl}/blog`,
        lastModified: latestPostDate,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error("[sitemap] Sanity query failed:", error instanceof Error ? error.message : error)
  }

  return [...staticPages, ...mediaPages, ...blogPages]
}
