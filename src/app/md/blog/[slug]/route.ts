import { loadPublishedPost } from "@/lib/published-blog"
import { portableTextMarkdown } from "@/lib/markdown/portable-text"
import { markdownUnavailable } from "@/lib/markdown/http"
import { urlFor } from "@/sanity/image"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"
export const revalidate = 300

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const post = await loadPublishedPost(slug)
    if (!post) return new Response("Article introuvable", { status: 404, headers: { "X-Robots-Tag": "noindex, follow", "Cache-Control": "no-store" } })
    const canonical = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`
    const body = [
      `# ${post.title}`, "", `URL canonique: ${canonical}`, `Auteur: ${post.author || "Totem Avisé"}`,
      `Publié le: ${post.publishedAt}`, `Mis à jour le: ${post._updatedAt ?? post.publishedAt}`, "Langue: français", "", post.excerpt, "",
      portableTextMarkdown(post.body ?? [], baseUrl, (block) => urlFor(block)?.width(800).auto("format").url() ?? null), "",
      `[Article sur Totem Avisé](${canonical})`, "",
    ].join("\n")
    return new Response(body, { headers: {
      "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow",
      "Link": `<${canonical}>; rel="canonical"`, "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    } })
  } catch { return markdownUnavailable() }
}
