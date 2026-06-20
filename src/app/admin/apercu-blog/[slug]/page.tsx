import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Calendar, Clock, MessagesSquare, User } from "lucide-react"
import { PortableText, type PortableTextBlock } from "@portabletext/react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { sanityPreviewClient } from "@/sanity/preview-client"
import { urlFor } from "@/sanity/image"
import { portableTextComponents } from "@/components/blog/PortableTextComponents"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  "temps-ecran": "Temps d'écran",
  "films-series": "Films & séries",
  "jeux-video": "Jeux vidéo",
  "parentalite-numerique": "Parentalité numérique",
  "guides-pratiques": "Guides pratiques",
  "actualites": "Actualités",
}

// Returns both draft + published rows for the slug; the page picks the draft.
const POST_QUERY = `*[_type == "post" && slug.current == $slug] {
  _id,
  title,
  "slug": slug.current,
  author,
  publishedAt,
  category,
  excerpt,
  mainImage,
  body
}`

interface Post {
  _id: string
  title: string
  slug: string
  author: string
  publishedAt?: string
  category: string
  excerpt: string
  mainImage?: { asset?: { _ref?: string }; alt?: string }
  body: PortableTextBlock[]
}

function getPlainText(blocks: PortableTextBlock[]) {
  return blocks
    .flatMap((block) => {
      if (!("children" in block) || !Array.isArray(block.children)) return []
      return block.children.map((child) =>
        child && typeof child === "object" && "text" in child && typeof child.text === "string" ? child.text : ""
      )
    })
    .join(" ")
}

function getReadingMinutes(blocks: PortableTextBlock[]) {
  const words = getPlainText(blocks).trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function AdminBlogPreviewDetail({ params }: PageProps) {
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

  const { slug } = await params

  if (!sanityPreviewClient) {
    redirect("/admin/apercu-blog")
  }

  const rows = await sanityPreviewClient.fetch<Post[]>(POST_QUERY, { slug })
  const post = rows.find((r) => r._id.startsWith("drafts.")) ?? rows[0]
  if (!post) notFound()

  const isDraft = rows.some((r) => r._id.startsWith("drafts."))
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Sans date"
  const imageUrl = urlFor(post.mainImage)?.width(1200).height(630).auto("format").url()
  const readingMinutes = getReadingMinutes(post.body || [])

  return (
    <article className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}>
      {/* Admin preview banner */}
      <div
        className="px-4 py-2.5 text-center text-sm font-medium"
        style={{ background: "var(--color-ink)", color: "var(--color-card)" }}
      >
        Aperçu admin {isDraft ? "· Brouillon (non publié)" : "· Publié"} — invisible pour le public
      </div>

      {imageUrl && (
        <div className="relative h-64 w-full bg-gray-100 sm:h-80 md:h-96">
          <Image src={imageUrl} alt={post.mainImage?.alt || post.title} fill className="object-cover" priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
        <nav className="mb-8 flex items-center gap-2 text-sm" style={{ color: "var(--color-ink2)" }}>
          <Link href="/admin/apercu-blog" className="transition-opacity hover:opacity-70">
            Aperçu du blog
          </Link>
          <span>/</span>
          <span className="truncate" style={{ color: "var(--color-ink)" }}>{post.title}</span>
        </nav>

        <header className="mb-8">
          <Badge
            variant="secondary"
            className="mb-4 border-0 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "var(--color-bg2)", color: "var(--color-accent)" }}
          >
            {CATEGORY_LABELS[post.category] || post.category}
          </Badge>
          <h1 className="mb-5 font-serif text-3xl font-medium leading-[1.05] md:text-5xl" style={{ color: "var(--color-ink)" }}>
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
          </div>
        </header>

        <aside
          className="mb-9 rounded-2xl p-5 md:p-6"
          style={{ background: "var(--color-bg2)", borderLeft: "4px solid var(--color-accent)" }}
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

        <div className="max-w-none">
          <PortableText value={post.body} components={portableTextComponents} />
        </div>

        <div className="mt-12 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <Link
            href="/admin/apercu-blog"
            className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--color-accent)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;aperçu
          </Link>
        </div>
      </div>
    </article>
  )
}
