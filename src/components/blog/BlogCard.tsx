import Image from "next/image"
import Link from "next/link"
import { Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { blogHeroImage } from "@/lib/blog-card"
import { formatBlogDate } from "@/lib/published-blog"
import { blogCategoryLabel } from "@/sanity/categories"

interface BlogCardProps {
  post: {
    slug: string
    title: string
    excerpt: string
    category: string
    publishedAt: string
    mainImage?: { asset?: { _ref?: string }; alt?: string }
  }
}

export function BlogCard({ post }: BlogCardProps) {
  // Photo when the post has one, otherwise its branded Totem card (never an empty frame).
  const hero = blogHeroImage(post, { width: 600, height: 340 })

  return (
    <Link href={`/blog/${post.slug}`} className="group">
      <article
        className="overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        style={{ background: "var(--color-card)", borderColor: "var(--color-line)" }}
      >
        <div className="relative aspect-[16/9]" style={{ background: "var(--color-bg2)" }}>
          <Image
            src={hero.url}
            // The branded card repeats the title shown just below: decorative.
            alt={hero.isFallbackCard ? "" : post.mainImage?.alt || post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={hero.isFallbackCard}
          />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="secondary"
              className="border-0 text-xs"
              style={{ background: "var(--color-bg2)", color: "var(--color-accent)" }}
            >
              {blogCategoryLabel(post.category)}
            </Badge>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-ink2)" }}>
              <Calendar className="h-3 w-3" />
              {formatBlogDate(post.publishedAt)}
            </span>
          </div>
          <h3
            className="font-serif font-medium transition-opacity group-hover:opacity-75 line-clamp-2 mb-1"
            style={{ color: "var(--color-ink)" }}
          >
            {post.title}
          </h3>
          <p className="text-sm line-clamp-2" style={{ color: "var(--color-ink2)" }}>
            {post.excerpt}
          </p>
        </div>
      </article>
    </Link>
  )
}
