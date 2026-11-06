/**
 * Branded fallback hero for blog posts without a photo (`mainImage`).
 *
 * Rendered by /api/blog/card/[slug] with next/og, like the news fallback card.
 * The route reads the title from the PUBLISHED post only (never from the URL),
 * so it can't be used to stamp arbitrary text under the Totem brand and never
 * reveals a draft's title. `cat` only picks a whitelisted category label, used
 * when the post isn't public (admin preview of a draft) or Sanity is down.
 */
import { urlFor } from "@/sanity/image"
import { isBlogCategory } from "@/sanity/categories"

export const BLOG_CARD_WIDTH = 1200
export const BLOG_CARD_HEIGHT = 630

/** Path of the branded card for a post (relative — prefix with the site URL for JSON-LD). */
export function blogCardPath(slug: string, category?: string | null): string {
  const base = `/api/blog/card/${encodeURIComponent(slug)}`
  return isBlogCategory(category) ? `${base}?cat=${category}` : base
}

export interface BlogHeroImage {
  /** Absolute (Sanity CDN) or site-relative (branded card) URL. */
  url: string
  /** True for the generated card: our own PNG, rendered with `unoptimized` like the news cards. */
  isFallbackCard: boolean
}

/** The post's photo when it has one, otherwise its branded card. */
export function blogHeroImage(
  post: { slug: string; category?: string | null; mainImage?: { asset?: { _ref?: string } } },
  size: { width: number; height: number },
): BlogHeroImage {
  const photo = urlFor(post.mainImage)?.width(size.width).height(size.height).auto("format").url()
  return photo ? { url: photo, isFallbackCard: false } : { url: blogCardPath(post.slug, post.category), isFallbackCard: true }
}
