"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Bookmark, BookOpen, Film, Heart, Newspaper } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MediaPreviewItem {
  id: string
  media: {
    id: string
    title: string
    posterUrl: string | null
    type: string
  }
}

interface SavedNewsItem {
  id: string
  savedAt: string
  readAt: string | null
  story: {
    id: string
    slug: string
    title: string
    summary: string
    category: string
    imageUrl: string | null
    publishedAt: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mediaFromRecord(value: unknown): MediaPreviewItem | null {
  if (!isRecord(value)) return null
  const mediaCandidate = isRecord(value.media) ? value.media : value
  const id = typeof mediaCandidate.id === "string" ? mediaCandidate.id : null
  const title = typeof mediaCandidate.title === "string" ? mediaCandidate.title : null
  if (!id || !title) return null
  return {
    id: typeof value.id === "string" ? value.id : id,
    media: {
      id,
      title,
      posterUrl: typeof mediaCandidate.posterUrl === "string" ? mediaCandidate.posterUrl : null,
      type: typeof mediaCandidate.type === "string" ? mediaCandidate.type : "MEDIA",
    },
  }
}

function mapMediaItems(value: unknown): MediaPreviewItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const mapped = mediaFromRecord(item)
    return mapped ? [mapped] : []
  })
}

function mapSavedNewsItems(value: unknown): SavedNewsItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.story)) return []
    const story = item.story
    // imageUrl can be null on legacy rows; we now handle that in the
    // card render. Other fields are required for a usable list entry.
    if (
      typeof item.id !== "string" ||
      typeof story.id !== "string" ||
      typeof story.slug !== "string" ||
      typeof story.title !== "string" ||
      typeof story.summary !== "string" ||
      typeof story.category !== "string" ||
      typeof story.publishedAt !== "string"
    ) {
      return []
    }
    return [{
      id: item.id,
      savedAt: typeof item.savedAt === "string" ? item.savedAt : "",
      readAt: typeof item.readAt === "string" ? item.readAt : null,
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        category: story.category,
        imageUrl: typeof story.imageUrl === "string" ? story.imageUrl : null,
        publishedAt: story.publishedAt,
      },
    }]
  })
}

function MediaListCard({
  title,
  icon: Icon,
  iconColor,
  href,
  items,
  emptyMessage,
  loading,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  href: string
  items: MediaPreviewItem[]
  emptyMessage: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
          <div className="h-6 w-28 bg-gray-100 rounded" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="aspect-[2/3] bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </h2>
        {items.length > 0 && (
          <Link
            href={href}
            className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors"
          >
            Voir tout <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Film className="h-8 w-8 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">{emptyMessage}</p>
            <Button variant="link" size="sm" asChild className="mt-2 text-violet-600">
              <Link href="/films">Explorer les films</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {items.map((item) => (
              <Link key={item.id} href={`/media/${item.media.id}`} className="group">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 relative hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  {item.media.posterUrl ? (
                    <Image
                      src={item.media.posterUrl}
                      alt={item.media.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="80px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SavedNewsCard({
  items,
  loading,
}: {
  items: SavedNewsItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
        <div className="px-6 py-5 border-b border-gray-50">
          <div className="h-6 w-36 bg-gray-100 rounded" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden md:col-span-2">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          &Agrave; lire plus tard
        </h2>
        {items.length > 0 && (
          <Link
            href="/apercudecouverte"
            className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors"
          >
            Actualit&eacute;s <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Newspaper className="h-8 w-8 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">Pas encore d&apos;articles gard&eacute;s</p>
            <Button variant="link" size="sm" asChild className="mt-2 text-violet-600">
              <Link href="/apercudecouverte">Lire les actualit&eacute;s</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/apercudecouverte/${item.story.slug}`}
                className="group flex gap-3 rounded-xl border border-gray-100 p-3 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors"
              >
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.story.imageUrl ? (
                    <Image
                      src={item.story.imageUrl}
                      alt={item.story.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="96px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Newspaper className="h-5 w-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                    {item.story.title}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500">
                    {item.story.summary}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function UserListsPreview() {
  const [favorites, setFavorites] = useState<MediaPreviewItem[]>([])
  const [watchlist, setWatchlist] = useState<MediaPreviewItem[]>([])
  const [savedNews, setSavedNews] = useState<SavedNewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLists() {
      try {
        const [favRes, watchRes, newsRes] = await Promise.all([
          fetch("/api/user/favorites?limit=6"),
          fetch("/api/user/watchlist?limit=6"),
          fetch("/api/user/saved-news?limit=4"),
        ])

        if (favRes.ok) {
          const data = await favRes.json()
          setFavorites(mapMediaItems(data.items ?? data.favorites).slice(0, 6))
        }

        if (watchRes.ok) {
          const data = await watchRes.json()
          setWatchlist(mapMediaItems(data.items ?? data.watchlist).slice(0, 6))
        }

        if (newsRes.ok) {
          const data = await newsRes.json()
          setSavedNews(mapSavedNewsItems(data.items))
        }
      } catch (error) {
        console.error("Failed to fetch lists:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLists()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MediaListCard
        title="Mes favoris"
        icon={Heart}
        iconColor="text-rose-500"
        href="/mes-favoris"
        items={favorites}
        emptyMessage="Pas encore de favoris"
        loading={loading}
      />
      <MediaListCard
        title="Ma liste &agrave; voir"
        icon={Bookmark}
        iconColor="text-amber-500"
        href="/ma-liste"
        items={watchlist}
        emptyMessage="Pas encore de films &agrave; voir"
        loading={loading}
      />
      <SavedNewsCard items={savedNews} loading={loading} />
    </div>
  )
}
