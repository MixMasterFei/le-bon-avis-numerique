import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { sanityClient } from "@/sanity/client"
import { PUBLIC_POST } from "@/lib/published-blog"
import { BLOG_CARD_HEIGHT, BLOG_CARD_WIDTH } from "@/lib/blog-card"
import { BlogCardArt } from "@/lib/blog-card-art"
import { isBlogCategory } from "@/sanity/categories"
import { SLUG_PATTERN } from "@/lib/blog-import"

// GET /api/blog/card/<slug>[?cat=<category>] — branded hero for a post without
// a photo (see src/lib/blog-card.ts). The title comes from the PUBLISHED post
// only; `cat` is a whitelisted fallback for drafts (admin preview) and outages.

const TITLE_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
// A category-only card may turn into a titled one when the post goes live:
// keep it short-lived so the publication shows up within minutes.
const FALLBACK_CACHE = "public, max-age=300, s-maxage=300"

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cat = req.nextUrl.searchParams.get("cat")
  const category = isBlogCategory(cat) ? cat : null

  if (!SLUG_PATTERN.test(slug) || slug.length > 96) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": FALLBACK_CACHE } })
  }

  let post: { title: string; category: string | null } | null = null
  let cmsDown = false
  try {
    post = await sanityClient.fetch<{ title: string; category: string | null } | null>(
      `*[${PUBLIC_POST} && slug.current == $slug][0]{ title, category }`,
      { slug },
      { perspective: "published" },
    )
  } catch (error) {
    cmsDown = true
    console.error("[blog-card] Sanity fetch failed:", error instanceof Error ? error.message : error)
  }

  // Unknown slug and nothing to fall back on: no card (keeps the URL space finite).
  if (!post && !category && !cmsDown) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": FALLBACK_CACHE } })
  }

  return new ImageResponse(<BlogCardArt title={post?.title ?? null} category={post?.category ?? category} />, {
    width: BLOG_CARD_WIDTH,
    height: BLOG_CARD_HEIGHT,
    headers: { "Cache-Control": post ? TITLE_CACHE : FALLBACK_CACHE },
  })
}
