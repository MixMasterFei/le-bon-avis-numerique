import { loadPublishedPosts } from "@/lib/published-blog"
import { markdownUnavailable } from "@/lib/markdown/http"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"
export const revalidate = 300
export async function GET() {
  try {
    const posts = await loadPublishedPosts()
    const body = ["# Blog Totem Avisé", "", `URL canonique: ${baseUrl}/blog`, "Langue: français", "",
      ...(posts.length ? posts.map((post) => `- [${post.title}](${baseUrl}/md/blog/${encodeURIComponent(post.slug)}) — ${post.publishedAt.slice(0, 10)}`)
        : ["Aucun article publié pour le moment."]), ""].join("\n")
    return new Response(body, { headers: {
      "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow",
      "Link": `<${baseUrl}/blog>; rel="canonical"`, "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    } })
  } catch { return markdownUnavailable() }
}
