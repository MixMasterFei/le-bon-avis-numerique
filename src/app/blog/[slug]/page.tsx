import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, ArrowLeft, User } from "lucide-react"
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

  const imageUrl = urlFor(post.mainImage)?.width(1200).height(630).auto("format").url()

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
    author: { "@type": "Person", name: post.author },
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
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  }

  return (
    <article className="min-h-screen">
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

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary">Accueil</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-primary">Blog</Link>
          <span>/</span>
          <span className="text-gray-700 truncate">{post.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 mb-3">
            {CATEGORY_LABELS[post.category] || post.category}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {date}
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="prose-totem">
          <PortableText value={post.body} components={portableTextComponents} />
        </div>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au blog
          </Link>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Articles similaires</h2>
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
