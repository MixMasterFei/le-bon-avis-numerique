import { cache } from "react"
import { unstable_cache } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { sanityClient } from "@/sanity/client"
import type { EditorialBlock } from "@/lib/markdown/portable-text"

// Explicit published perspective AND a draft/date gate. Never use the preview
// client for these public routes, even when a preview token is configured.
// The date gate is also what makes scheduling work: a post published in
// Sanity with a future publishedAt stays invisible everywhere until then.
export const PUBLIC_POST = `_type == "post" && !(_id in path("drafts.**")) && defined(slug.current) && defined(publishedAt) && publishedAt <= now()`

/** /blog asks to be indexed from this many visible posts (one post is a thin hub page). */
export const BLOG_INDEX_MIN_POSTS = 2

/** The « Comment lire cet âge ? » article linked from film fiches (draft 12). */
export const AGE_GUIDE_POST_SLUG = "bon-age-film-enfant"

export interface PublishedPost {
  title: string; slug: string; author: string; publishedAt: string; _updatedAt?: string
  excerpt: string; body: EditorialBlock[]
}
export async function loadPublishedPost(slug: string): Promise<PublishedPost | null> {
  return sanityClient.fetch(`*[${PUBLIC_POST} && slug.current == $slug][0]{title, "slug": slug.current, author, publishedAt, _updatedAt, excerpt, body}`, { slug }, { perspective: "published" })
}
export async function loadPublishedPosts(): Promise<Pick<PublishedPost, "title" | "slug" | "publishedAt" | "excerpt">[]> {
  return sanityClient.fetch(`*[${PUBLIC_POST}] | order(publishedAt desc){title, "slug": slug.current, publishedAt, excerpt}`, {}, { perspective: "published" })
}

/** Dates are shown in Paris time, whatever the server's timezone (UTC on Vercel). */
export function formatBlogDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })
}

/**
 * A CMS failure on a public blog surface: logged AND sent to Sentry, so an
 * outage is never mistaken for « no article yet ».
 */
export function reportBlogFetchError(scope: string, error: unknown): void {
  console.error(`[blog] ${scope}: Sanity fetch failed —`, error instanceof Error ? error.message : error)
  Sentry.captureException(error, { tags: { area: "blog", scope } })
}

export interface BlogListPost {
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt: string
  mainImage?: { asset?: { _ref?: string }; alt?: string }
}

export type BlogListing = { ok: true; posts: BlogListPost[] } | { ok: false; posts: [] }

/**
 * Posts for /blog, deduped per request (generateMetadata + page share one
 * fetch). `ok: false` = Sanity unreachable, reported once here.
 */
export const loadBlogListing = cache(async (): Promise<BlogListing> => {
  try {
    const posts = await sanityClient.fetch<BlogListPost[]>(
      `*[${PUBLIC_POST}] | order(publishedAt desc) { "slug": slug.current, title, excerpt, category, publishedAt, mainImage }`,
      {},
      { perspective: "published" },
    )
    return { ok: true, posts: Array.isArray(posts) ? posts : [] }
  } catch (error) {
    reportBlogFetchError("listing", error)
    return { ok: false, posts: [] }
  }
})

// The header, the footer and every film fiche ask « is the blog live? » on
// each render: bounded (an outage must not slow the whole site) and cached.
const LIVE_SLUGS_TIMEOUT_MS = 2500

const cachedLiveBlogSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const slugs = await sanityClient.fetch<unknown>(
      `*[${PUBLIC_POST}].slug.current`,
      {},
      { perspective: "published", signal: AbortSignal.timeout(LIVE_SLUGS_TIMEOUT_MS) },
    )
    return Array.isArray(slugs) ? slugs.filter((s): s is string => typeof s === "string") : []
  },
  ["blog-live-slugs"],
  // A failed refresh throws, so the previous value is kept, not replaced by [].
  { revalidate: 300, tags: ["blog"] },
)

/**
 * Slugs of the posts readers can open right now (≤ 5 min old). Never throws:
 * when Sanity is unreachable, blog links are hidden rather than broken.
 */
export async function getLiveBlogSlugs(): Promise<string[]> {
  try {
    return await cachedLiveBlogSlugs()
  } catch (error) {
    console.error("[blog] live slugs unavailable:", error instanceof Error ? error.message : error)
    return []
  }
}

export async function isBlogPostLive(slug: string): Promise<boolean> {
  return (await getLiveBlogSlugs()).includes(slug)
}
