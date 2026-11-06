import type { Metadata } from "next"
import Link from "next/link"
import { CloudOff, Newspaper } from "lucide-react"
import { BlogCard } from "@/components/blog/BlogCard"
import { BLOG_INDEX_MIN_POSTS, loadBlogListing } from "@/lib/published-blog"

export const revalidate = 300 // 5-min ISR (inert while the root layout reads the session)

const TITLE = "Blog — Conseils et actualités pour les familles"
const DESCRIPTION =
  "Articles sur le temps d'écran, les films, les jeux vidéo et la parentalité numérique. Conseils pratiques pour accompagner vos enfants dans le monde des médias."

/**
 * Indexable only once the hub has real content (≥ BLOG_INDEX_MIN_POSTS visible
 * posts) — an empty or one-post listing is a thin page. When Sanity can't be
 * read the count is unknown, so the page stays noindex (fail closed); the
 * outage itself is reported by loadBlogListing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const listing = await loadBlogListing()
  const indexable = listing.ok && listing.posts.length >= BLOG_INDEX_MIN_POSTS
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/blog" },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: "Blog | Totem Avisé",
      description: "Articles et conseils pour les familles sur les médias et le numérique.",
      images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
    },
  }
}

export default async function BlogPage() {
  const listing = await loadBlogListing()
  const posts = listing.posts

  const baseUrl = "https://totemavise.com"
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
    ],
  }

  const itemListLd = posts.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Articles du blog Totem Avisé",
        numberOfItems: posts.length,
        itemListElement: posts.slice(0, 20).map((post, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${baseUrl}/blog/${post.slug}`,
          name: post.title,
        })),
      }
    : null

  return (
    <main className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}>
      <div className="container mx-auto px-4 py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      <div className="text-center mb-12">
        <div className="inline-flex p-4 rounded-full mb-6" style={{ background: "var(--color-bg2)" }}>
          <Newspaper className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.05] mb-4" style={{ color: "var(--color-ink)" }}>Notre blog</h1>
        <p className="max-w-2xl mx-auto text-lg leading-relaxed" style={{ color: "var(--color-ink2)" }}>
          Articles, conseils et actualités sur le temps d&apos;écran, les films, les jeux vidéo et la parentalité numérique.
        </p>
      </div>

      {!listing.ok ? (
        // Sanity unreachable: say so — « aucun article » would be false.
        <div className="text-center py-16" style={{ color: "var(--color-ink2)" }} role="status">
          <CloudOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Les articles sont momentanément indisponibles</p>
          <p className="text-sm">
            Nous n&apos;arrivons pas à les charger pour l&apos;instant. Réessayez dans quelques minutes, ou consultez{" "}
            <Link href="/guides" className="underline" style={{ color: "var(--color-accent)" }}>
              nos guides
            </Link>
            .
          </p>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16" style={{ color: "var(--color-ink2)" }}>
          <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucun article pour le moment</p>
          <p className="text-sm">Nos premiers articles arrivent bientôt !</p>
        </div>
      )}
      </div>
    </main>
  )
}
