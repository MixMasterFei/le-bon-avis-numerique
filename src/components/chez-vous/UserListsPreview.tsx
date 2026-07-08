"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Bookmark, BookOpen, Film, Heart, Newspaper } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const p = APERCU_PALETTE

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
      <div
        className="rounded-2xl overflow-hidden animate-pulse"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.line}` }}>
          <div className="h-6 w-28 rounded" style={{ background: p.placeholder }} />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="aspect-[2/3] rounded-lg" style={{ background: p.placeholder }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.line}` }}>
        <h2 className="flex items-center gap-2 font-serif text-lg font-medium" style={{ color: p.ink, letterSpacing: "-0.01em" }}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </h2>
        {items.length > 0 && (
          <Link
            href={href}
            className="text-sm font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: p.accent }}
          >
            Voir tout <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Film className="h-8 w-8 mx-auto mb-3" style={{ color: p.ink2, opacity: 0.4 }} />
            <p className="text-sm" style={{ color: p.ink2 }}>{emptyMessage}</p>
            <Link
              href="/films"
              className="inline-block mt-2 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: p.accent }}
            >
              Explorer les films
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {items.map((item) => (
              <Link key={item.id} href={`/media/${item.media.id}`} className="group">
                <div
                  className="aspect-[2/3] rounded-lg overflow-hidden relative hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  style={{ background: p.placeholder }}
                >
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
                      <Film className="h-4 w-4" style={{ color: p.ink2, opacity: 0.5 }} />
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
      <div
        className="rounded-2xl overflow-hidden animate-pulse"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div className="px-6 py-5" style={{ borderBottom: `1px solid ${p.line}` }}>
          <div className="h-6 w-36 rounded" style={{ background: p.placeholder }} />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-16 rounded-xl" style={{ background: p.placeholder }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden md:col-span-2"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.line}` }}>
        <h2 className="flex items-center gap-2 font-serif text-lg font-medium" style={{ color: p.ink, letterSpacing: "-0.01em" }}>
          <BookOpen className="h-5 w-5" style={{ color: p.accent }} />
          &Agrave; lire plus tard
        </h2>
        {items.length > 0 && (
          <Link
            href="/apercudecouverte"
            className="text-sm font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: p.accent }}
          >
            Actualit&eacute;s <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Newspaper className="h-8 w-8 mx-auto mb-3" style={{ color: p.ink2, opacity: 0.4 }} />
            <p className="text-sm" style={{ color: p.ink2 }}>Pas encore d&apos;articles gard&eacute;s</p>
            <Link
              href="/apercudecouverte"
              className="inline-block mt-2 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: p.accent }}
            >
              Lire les actualit&eacute;s
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/apercudecouverte/${item.story.slug}`}
                className="group flex gap-3 rounded-xl p-3 transition-colors"
                style={{ border: `1px solid ${p.line}` }}
              >
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg" style={{ background: p.placeholder }}>
                  {item.story.imageUrl ? (
                    <Image
                      src={item.story.imageUrl}
                      alt={item.story.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="96px"
                      // Raw publisher CDN (unbounded host) — bypass the optimizer.
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Newspaper className="h-5 w-5" style={{ color: p.ink2, opacity: 0.5 }} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: p.ink }}>
                    {item.story.title}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug" style={{ color: p.ink2 }}>
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
