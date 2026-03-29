import Image from "next/image"
import Link from "next/link"
import { Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { urlFor } from "@/sanity/image"

const CATEGORY_LABELS: Record<string, string> = {
  "temps-ecran": "Temps d'écran",
  "films-series": "Films & séries",
  "jeux-video": "Jeux vidéo",
  "parentalite-numerique": "Parentalité numérique",
  "guides-pratiques": "Guides pratiques",
  "actualites": "Actualités",
}

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
  const imageUrl = urlFor(post.mainImage)?.width(600).height(340).auto("format").url()
  const date = new Date(post.publishedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Link href={`/blog/${post.slug}`} className="group">
      <article className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-[16/9] bg-gray-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={post.mainImage?.alt || post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
              {CATEGORY_LABELS[post.category] || post.category}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="h-3 w-3" />
              {date}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {post.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2">
            {post.excerpt}
          </p>
        </div>
      </article>
    </Link>
  )
}
