import { sanityClient } from "@/sanity/client"
import type { EditorialBlock } from "@/lib/markdown/portable-text"

// Explicit published perspective AND a draft/date gate. Never use the preview
// client for these public routes, even when a preview token is configured.
export const PUBLIC_POST = `_type == "post" && !(_id in path("drafts.**")) && defined(slug.current) && defined(publishedAt) && publishedAt <= now()`
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
