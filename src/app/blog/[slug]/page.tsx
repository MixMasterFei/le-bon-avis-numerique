import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, Calendar, Clock, History, MessagesSquare, User } from "lucide-react"
import { PortableText, type PortableTextBlock } from "@portabletext/react"
import { Badge } from "@/components/ui/badge"
import { sanityClient } from "@/sanity/client"
import { urlFor } from "@/sanity/image"
import { portableTextComponents } from "@/components/blog/PortableTextComponents"
import { BlogCard } from "@/components/blog/BlogCard"

export const revalidate = 300

const CATEGORY_LABELS: Record<string, string> = {
  "temps-ecran": "Temps d'écran",
  "films-series": "Films & séries",
  "jeux-video": "Jeux vidéo",
  "parentalite-numerique": "Parentalité numérique",
  "guides-pratiques": "Guides pratiques",
  "actualites": "Actualités",
}

function getPlainText(blocks: PortableTextBlock[]) {
  return blocks
    .flatMap((block) => {
      if (!("children" in block) || !Array.isArray(block.children)) return []
      return block.children.map((child) =>
        child && typeof child === "object" && "text" in child && typeof child.text === "string"
          ? child.text
          : ""
      )
    })
    .join(" ")
}

function getReadingMinutes(blocks: PortableTextBlock[]) {
  const words = getPlainText(blocks).trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

const POST_QUERY = `*[_type == "post" && slug.current == $slug && defined(publishedAt) && publishedAt <= now()][0] {
  title,
  "slug": slug.current,
  author,
  publishedAt,
  _updatedAt,
  category,
  excerpt,
  mainImage,
  body,
  seoTitle,
  seoDescription
}`

const RELATED_QUERY = `*[_type == "post" && category == $category && slug.current != $slug && defined(publishedAt) && publishedAt <= now()] | order(publishedAt desc) [0...3] {
  "slug": slug.current,
  title,
  excerpt,
  category,
  publishedAt,
  mainImage
}`

interface Post {
  title: string
  slug: string
  author: string
  publishedAt: string
  _updatedAt?: string
  category: string
  excerpt: string
  mainImage?: { asset?: { _ref?: string }; alt?: string }
  body: PortableTextBlock[]
  seoTitle?: string
  seoDescription?: string
}

interface RelatedPost {
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt: string
  mainImage?: { asset?: { _ref?: string }; alt?: string }
}

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await sanityClient.fetch<Post | null>(POST_QUERY, { slug })

  if (!post) return { title: "Article introuvable" }

  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt
  const imageUrl = urlFor(post.mainImage)?.width(1200).height(630).auto("format").url()

  return {
    title: `${title} — Blog Totem Avisé`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: post.title }] : undefined,
    },
  }
}

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(
    `*[_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()]{ "slug": slug.current }`
  )
  return slugs.map((s) => ({ slug: s.slug }))
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await sanityClient.fetch<Post | null>(POST_QUERY, { slug })

  if (!post) notFound()

  const relatedPosts = await sanityClient.fetch<RelatedPost[]>(RELATED_QUERY, {
    category: post.category,
    slug: post.slug,
  })

  const date = new Date(post.publishedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Show an "updated on" date only when the post was meaningfully edited after publishing.
  const updatedAt = post._updatedAt ? new Date(post._updatedAt) : null
  const showUpdated =
    !!updatedAt && updatedAt.getTime() - new Date(post.publishedAt).getTime() > 24 * 60 * 60 * 1000
  const updatedDate = updatedAt
    ? updatedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null

  const imageUrl = urlFor(post.mainImage)?.width(1200).height(630).auto("format").url()
  const readingMinutes = getReadingMinutes(post.body || [])

  const articleSection = CATEGORY_LABELS[post.category] || post.category
  const postUrl = `https://totemavise.com/blog/${post.slug}`

  // JSON-LD Article structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post._updatedAt || post.publishedAt,
    inLanguage: "fr-FR",
    articleSection,
    author: {
      "@type": post.author === "Totem Avisé" ? "Organization" : "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Totem Avisé",
      logo: { "@type": "ImageObject", url: "https://totemavise.com/icon.png" },
    },
    ...(imageUrl ? { image: imageUrl } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    url: postUrl,
  }

  // BreadcrumbList JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://totemavise.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://totemavise.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  }

  return (
    <article className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Hero image */}
      {imageUrl && (
        <div className="relative w-full h-64 sm:h-80 md:h-96 bg-gray-100">
          <Image
            src={imageUrl}
            alt={post.mainImage?.alt || post.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
        {/* Breadcrumbs */}
        <nav className="mb-8 flex items-center gap-2 text-sm" style={{ color: "var(--color-ink2)" }}>
          <Link href="/" className="transition-opacity hover:opacity-70">Accueil</Link>
          <span>/</span>
          <Link href="/blog" className="transition-opacity hover:opacity-70">Blog</Link>
          <span>/</span>
          <span className="truncate" style={{ color: "var(--color-ink)" }}>{post.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <Badge
            variant="secondary"
            className="mb-4 border-0 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "var(--color-bg2)", color: "var(--color-accent)" }}
          >
            {CATEGORY_LABELS[post.category] || post.category}
          </Badge>
          <h1
            className="font-serif mb-5 text-3xl font-medium leading-[1.05] md:text-5xl"
            style={{ color: "var(--color-ink)" }}
          >
            {post.title}
          </h1>
          <p className="mb-5 text-lg leading-relaxed md:text-xl" style={{ color: "var(--color-ink2)" }}>
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--color-ink2)" }}>
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingMinutes} min de lecture
            </span>
            {showUpdated && (
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--color-accent)" }}>
                <History className="h-4 w-4" />
                Mis à jour le {updatedDate}
              </span>
            )}
          </div>
        </header>

        <aside
          className="mb-9 rounded-2xl p-5 md:p-6"
          style={{
            background: "var(--color-bg2)",
            borderLeft: "4px solid var(--color-accent)",
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            <div className="font-serif text-base font-medium md:text-lg" style={{ color: "var(--color-ink)" }}>
              A retenir pour les parents
            </div>
          </div>
          <p className="m-0 text-base leading-relaxed" style={{ color: "var(--color-ink)" }}>
            {post.excerpt}
          </p>
        </aside>

        {/* Body */}
        <div className="max-w-none">
          <PortableText value={post.body} components={portableTextComponents} />
        </div>

        {/* Editorial note — author + sourcing + method (identity & trust signal) */}
        <aside
          className="mt-10 rounded-2xl p-5 md:p-6"
          style={{ background: "var(--color-bg2)", border: "1px solid var(--color-line)" }}
        >
          <div className="font-serif text-base font-medium" style={{ color: "var(--color-ink)" }}>
            {post.author}
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-ink2)" }}>
            Les sources utilisées sont liées dans l’article. Pour comprendre les
            repères présentés sur Totem Avisé, consultez{" "}
            <Link href="/notre-methode" className="underline" style={{ color: "var(--color-accent)" }}>
              notre méthode
            </Link>
            . {showUpdated ? `Dernière mise à jour le ${updatedDate}.` : `Publié le ${date}.`}
          </p>
        </aside>

        <aside
          className="mt-12 rounded-2xl p-5 md:p-6"
          style={{ background: "var(--color-bg2)", border: "1px solid var(--color-line)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            <div className="font-serif text-lg font-medium" style={{ color: "var(--color-ink)" }}>
              Continuer avec Totem Avisé
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-ink2)" }}>
            Comparez les films, séries et jeux selon l&apos;âge, la sensibilité et le contexte de votre famille.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/films"
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-75"
              style={{ background: "var(--color-card)", color: "var(--color-ink)" }}
            >
              Explorer les films
            </Link>
            <Link
              href="/jeux"
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-75"
              style={{ background: "var(--color-card)", color: "var(--color-ink)" }}
            >
              Voir les jeux
            </Link>
            <Link
              href="/guides"
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-75"
              style={{ background: "var(--color-card)", color: "var(--color-ink)" }}
            >
              Lire les guides
            </Link>
          </div>
        </aside>

        {/* Back link */}
        <div className="mt-12 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--color-accent)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au blog
          </Link>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif text-2xl font-medium mb-6" style={{ color: "var(--color-ink)" }}>
              Articles similaires
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((related) => (
                <BlogCard key={related.slug} post={related} />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
