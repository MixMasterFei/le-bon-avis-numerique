import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Calendar, FileText, Newspaper } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { sanityPreviewClient } from "@/sanity/preview-client"
import { formatBlogDate } from "@/lib/published-blog"
import { blogHeroImage } from "@/lib/blog-card"
import { blogCategoryLabel } from "@/sanity/categories"

export const dynamic = "force-dynamic"

// All posts (drafts + published). No publishedAt<=now() gate so future-dated
// drafts also show. We dedupe by slug in JS, preferring the draft version.
const ALL_POSTS_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
  _id,
  "slug": slug.current,
  title,
  excerpt,
  category,
  publishedAt,
  mainImage
}`

interface PreviewPost {
  _id: string
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt?: string
  mainImage?: { asset?: { _ref?: string }; alt?: string }
}

function formatDate(iso?: string) {
  if (!iso) return "Sans date"
  return formatBlogDate(iso)
}

export default async function AdminBlogPreviewPage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== "ADMIN" && role !== "MODERATOR") {
    redirect("/")
  }

  if (!sanityPreviewClient) {
    return (
      <main className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}>
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 opacity-50" />
          <h1 className="font-serif text-2xl font-medium">Aperçu indisponible</h1>
          <p className="mt-3 text-sm" style={{ color: "var(--color-ink2)" }}>
            Le jeton Sanity (SANITY_API_WRITE_TOKEN) n&apos;est pas configuré sur cet environnement.
            Ajoutez-le aux variables d&apos;environnement pour visualiser les brouillons ici.
          </p>
        </div>
      </main>
    )
  }

  let all: PreviewPost[] = []
  try {
    all = await sanityPreviewClient.fetch<PreviewPost[]>(ALL_POSTS_QUERY)
  } catch (error) {
    console.error("Failed to fetch blog previews:", error)
  }

  // Prefer the draft version of each slug; mark whether it is still a draft.
  const bySlug = new Map<string, PreviewPost>()
  for (const p of all) {
    const isDraft = p._id.startsWith("drafts.")
    if (!bySlug.has(p.slug) || isDraft) bySlug.set(p.slug, p)
  }
  const posts = [...bySlug.values()]
  const draftCount = posts.filter((p) => all.some((a) => a.slug === p.slug && a._id.startsWith("drafts."))).length

  return (
    <main className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}>
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="mb-10 text-center">
          <div className="mb-6 inline-flex rounded-full p-4" style={{ background: "var(--color-bg2)" }}>
            <Newspaper className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
          </div>
          <h1 className="font-serif text-4xl font-medium leading-[1.05] md:text-5xl" style={{ color: "var(--color-ink)" }}>
            Aperçu du blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--color-ink2)" }}>
            Vue admin de tous les articles, brouillons compris, rendus exactement comme sur le blog public.
          </p>
          <p className="mt-3 text-sm" style={{ color: "var(--color-ink2)" }}>
            {posts.length} article{posts.length > 1 ? "s" : ""} · {draftCount} brouillon{draftCount > 1 ? "s" : ""}
          </p>
        </div>

        {posts.length > 0 ? (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const isDraft = all.some((a) => a.slug === post.slug && a._id.startsWith("drafts."))
              // No photo → the placeholder card (category only: a draft's title is never public).
              const hero = blogHeroImage(post, { width: 600, height: 340 })
              return (
                <Link key={post.slug} href={`/admin/apercu-blog/${post.slug}`} className="group">
                  <article
                    className="overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-line)" }}
                  >
                    <div className="relative aspect-[16/9]" style={{ background: "var(--color-bg2)" }}>
                      <Image
                        src={hero.url}
                        alt={hero.isFallbackCard ? "" : post.mainImage?.alt || post.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized={hero.isFallbackCard}
                      />
                      {isDraft && (
                        <span
                          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: "var(--color-ink)", color: "var(--color-card)" }}
                        >
                          Brouillon
                        </span>
                      )}
                      {hero.isFallbackCard && (
                        <span
                          className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ background: "var(--color-card)", color: "var(--color-ink2)" }}
                          title="Pas encore d'illustration : la carte Totem s'affiche en attendant"
                        >
                          Carte provisoire
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="border-0 text-xs"
                          style={{ background: "var(--color-bg2)", color: "var(--color-accent)" }}
                        >
                          {blogCategoryLabel(post.category)}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-ink2)" }}>
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.publishedAt)}
                        </span>
                      </div>
                      <h3
                        className="mb-1 line-clamp-2 font-serif font-medium transition-opacity group-hover:opacity-75"
                        style={{ color: "var(--color-ink)" }}
                      >
                        {post.title}
                      </h3>
                      <p className="line-clamp-2 text-sm" style={{ color: "var(--color-ink2)" }}>
                        {post.excerpt}
                      </p>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center" style={{ color: "var(--color-ink2)" }}>
            <Newspaper className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg font-medium">Aucun article trouvé</p>
            <p className="text-sm">Importez ou créez des articles dans Sanity Studio (/studio).</p>
          </div>
        )}
      </div>
    </main>
  )
}
