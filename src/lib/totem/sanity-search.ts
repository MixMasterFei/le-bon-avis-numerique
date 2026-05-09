import { sanityClient } from "@/sanity/client"

export interface BlogSearchHit {
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  publishedAt: string
}

const PUBLISHED_FILTER =
  '_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()'

const SELECT = '"slug": slug.current, title, excerpt, category, publishedAt'

/**
 * Text-search across published blog posts.
 *
 * Uses Sanity's `match` operator on title, excerpt, and category. Limit
 * is clamped to [1, 10] regardless of input. Empty query returns the
 * most recent posts (useful as a discovery fallback).
 */
export async function searchPublishedBlogPosts(
  q: string | undefined,
  limit: number,
): Promise<BlogSearchHit[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)))
  const query = q?.trim() ?? ""

  if (query.length === 0) {
    const groq = `*[${PUBLISHED_FILTER}] | order(publishedAt desc) [0...${safeLimit}] { ${SELECT} }`
    return sanityClient.fetch<BlogSearchHit[]>(groq)
  }

  // Sanity match wildcards: append * for prefix-match across whole words.
  const escaped = query.replace(/"/g, '\\"')
  const groq = `*[${PUBLISHED_FILTER} && (title match $q || excerpt match $q || category match $q)] | order(publishedAt desc) [0...${safeLimit}] { ${SELECT} }`
  return sanityClient.fetch<BlogSearchHit[]>(groq, { q: `*${escaped}*` })
}
