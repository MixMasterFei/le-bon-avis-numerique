import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { toMediaRouteId, publicMediaWhere } from "@/lib/media-route"
import { sanityClient } from "@/sanity/client"
import { COLLECTIONS } from "@/lib/collections-data"
import { isAiConnectorsPagePublic } from "@/lib/ai-connectors-flag"

/**
 * Sitemap content, split per section and served by app/sitemap.ts
 * (generateSitemaps → /sitemap/<id>.xml) behind a sitemap index at
 * /sitemap.xml (app/sitemap-index.xml/route.ts, reached through a rewrite in
 * next.config.ts).
 *
 * WHY THE SPLIT — the single /sitemap.xml never regenerated. When a route is
 * prerendered and its path is a "static metadata file" (`/sitemap.xml`,
 * `/robots.txt`…), Next 16 hands it to the deployment adapter as a plain STATIC
 * FILE (adapter/build-complete.js → outputs.staticFiles), dropping its
 * `revalidate`. Vercel then serves the build-time file until the next deploy:
 * production kept the 10 Oct 2026 build (11 520 URLs, `x-vercel-cache: HIT`,
 * `content-disposition: …filename="sitemap.xml"`) for four weeks despite
 * `revalidate = 21600`, and every fiche created since was missing.
 * `/sitemap/<id>.xml` and `/sitemap-index.xml` are not static metadata paths,
 * so they come out as real ISR prerenders with a regeneration function.
 *
 * Do not move the index back to app/sitemap.xml/route.ts (Turbopack rejects it
 * next to app/sitemap.ts) nor collapse this back into one prerendered
 * /sitemap.xml — either way it freezes again.
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const SITEMAP_IDS = ["pages", "films", "series", "jeux"] as const
export type SitemapId = (typeof SITEMAP_IDS)[number]
type CatalogueSitemapId = Exclude<SitemapId, "pages">
type CatalogueMediaType = "MOVIE" | "TV" | "GAME"

/** One child sitemap per catalogue section. BOOK/APP aren't offered; MANGA is admin-only. */
export const SITEMAP_MEDIA_TYPE: Record<CatalogueSitemapId, CatalogueMediaType> = {
  films: "MOVIE",
  series: "TV",
  jeux: "GAME",
}

/** sitemaps.org hard limit per file. Each section is far below it today. */
export const MAX_URLS_PER_SITEMAP = 50_000

export function isSitemapId(id: string): id is SitemapId {
  return (SITEMAP_IDS as readonly string[]).includes(id)
}

export function sitemapUrl(id: SitemapId): string {
  return `${baseUrl}/sitemap/${id}.xml`
}

/**
 * During `next build` a failing source (placeholder DATABASE_URL in CI, a
 * Sanity hiccup) must not fail the build: publish the sitemap without it.
 * At RUNTIME the same failure must throw instead — the ISR regeneration then
 * fails and the previous good sitemap keeps being served, rather than an empty
 * /sitemap/films.xml being cached for 6 h.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build"
}

async function sourceOrSkip<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (!isBuildPhase()) throw error
    console.error(`[sitemap] ${label} failed during build, published without it:`, error instanceof Error ? error.message : error)
    return fallback
  }
}

export function staticPageEntries(now: Date): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/films`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/series`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/jeux`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/jeux/quel-age`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    // /mangas intentionally omitted — admin-only during soft launch.
    // /livres removed — books aren't part of the offering (route redirects to home).
    { url: `${baseUrl}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    // /recommandations omitted — client-side filtering page that SSR-renders
    // with "0 résultats" (thin content); noindex set via layout.tsx.
    { url: `${baseUrl}/recherche`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/notre-methode`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // /assistants-ia (connector documentation) only once it is public — it
    // stays admin-only until AI_CONNECTORS_PAGE_PUBLIC=true.
    ...(isAiConnectorsPagePublic()
      ? [{ url: `${baseUrl}/assistants-ia`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 }]
      : []),
    { url: `${baseUrl}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/objectif`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/nos-valeurs`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    // Age range pages
    { url: `${baseUrl}/age/2-4`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/5-7`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/8-10`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/11-12`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/13-15`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/age/16-plus`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ]
}

/**
 * Individual collection pages ("Top 10 des films Pixar"…) — primary SEO
 * landing pages; before July 2026 only the hub was listed and the pages
 * themselves were client-rendered, so Google never found them.
 */
export function collectionEntries(): MetadataRoute.Sitemap {
  return COLLECTIONS.map((c) => ({
    url: `${baseUrl}/collections/${c.id}`,
    lastModified: new Date(`${c.lastUpdated}-01`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }))
}

export async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  const posts = await sanityClient.fetch<{ slug: string; publishedAt: string }[]>(
    `*[_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()]{ "slug": slug.current, publishedAt }`
  )
  const entries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))
  // Add the blog listing page only when there is published content.
  // An empty editorial hub is a weak landing page for both visitors and SEO.
  if (posts.length > 0) {
    const latestPostDate = new Date(
      posts.reduce((max, p) => (p.publishedAt > max ? p.publishedAt : max), posts[0].publishedAt)
    )
    entries.unshift({
      url: `${baseUrl}/blog`,
      lastModified: latestPostDate,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  }
  return entries
}

/**
 * Public fiches of one type. lastModified is contentUpdatedAt (last change to
 * age, synopsis or analysis) — NOT updatedAt, which the nightly bookkeeping
 * moved on every row and turned every <lastmod> into "today".
 */
export async function mediaEntries(type: CatalogueMediaType): Promise<MetadataRoute.Sitemap> {
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: { ...publicMediaWhere, type },
      select: { id: true, type: true, contentUpdatedAt: true },
      orderBy: [{ contentUpdatedAt: "desc" }, { id: "asc" }],
      take: MAX_URLS_PER_SITEMAP,
    })
  )
  if (rows.length >= MAX_URLS_PER_SITEMAP) {
    console.warn(`[sitemap] ${type} reached the ${MAX_URLS_PER_SITEMAP}-URL cap — split this section into pages`)
  }
  return rows.map((item) => ({
    url: `${baseUrl}/media/${toMediaRouteId(item.type, item.id)}`,
    lastModified: item.contentUpdatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))
}

/** Content of /sitemap/<id>.xml. Unknown ids yield an empty set (the route 404s them first). */
export async function buildSitemap(id: string, now: Date = new Date()): Promise<MetadataRoute.Sitemap> {
  if (!isSitemapId(id)) return []
  if (id === "pages") {
    const blog = await sourceOrSkip("Sanity blog query", blogEntries, [])
    return [...staticPageEntries(now), ...collectionEntries(), ...blog]
  }
  const type = SITEMAP_MEDIA_TYPE[id]
  return sourceOrSkip(`${type} query`, () => mediaEntries(type), [])
}

/** Most recent content change per catalogue type, for the index <lastmod>. */
export async function latestContentUpdateByType(): Promise<Partial<Record<CatalogueMediaType, Date>>> {
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.groupBy({
      by: ["type"],
      where: { ...publicMediaWhere, type: { in: Object.values(SITEMAP_MEDIA_TYPE) } },
      _max: { contentUpdatedAt: true },
    })
  )
  const latest: Partial<Record<CatalogueMediaType, Date>> = {}
  for (const row of rows) {
    if (row._max.contentUpdatedAt) latest[row.type as CatalogueMediaType] = row._max.contentUpdatedAt
  }
  return latest
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function buildSitemapIndexXml(entries: { loc: string; lastModified?: Date | null }[]): string {
  const body = entries
    .map((e) => {
      const lastmod = e.lastModified ? `\n<lastmod>${e.lastModified.toISOString()}</lastmod>` : ""
      return `<sitemap>\n<loc>${escapeXml(e.loc)}</loc>${lastmod}\n</sitemap>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

/**
 * The sitemap index. Catalogue sections carry the date of their latest
 * content change; the "pages" section gets none (its homepage entry is
 * stamped at each regeneration, so a date would mean nothing). A database
 * failure degrades to an index without dates — still valid, still complete.
 */
export async function buildSitemapIndex(): Promise<string> {
  let latest: Partial<Record<CatalogueMediaType, Date>> = {}
  try {
    latest = await latestContentUpdateByType()
  } catch (error) {
    console.error("[sitemap] index lastmod query failed, served without dates:", error instanceof Error ? error.message : error)
  }
  return buildSitemapIndexXml(
    SITEMAP_IDS.map((id) => ({
      loc: sitemapUrl(id),
      lastModified: id === "pages" ? null : latest[SITEMAP_MEDIA_TYPE[id]] ?? null,
    }))
  )
}
