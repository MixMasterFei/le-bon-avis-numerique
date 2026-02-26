"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Bookmark, ArrowRight, Film } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ListItem {
  id: string
  mediaId: string
  media: {
    id: string
    title: string
    posterUrl: string | null
    type: string
  }
}

function ListCard({
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
  items: ListItem[]
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
              <Link
                key={item.id}
                href={`/media/${item.media.id}`}
                className="group"
              >
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

export function UserListsPreview() {
  const [favorites, setFavorites] = useState<ListItem[]>([])
  const [watchlist, setWatchlist] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLists() {
      try {
        const [favRes, watchRes] = await Promise.all([
          fetch("/api/user/favorites?limit=6"),
          fetch("/api/user/watchlist?limit=6"),
        ])

        if (favRes.ok) {
          const data = await favRes.json()
          setFavorites(data.items || [])
        }

        if (watchRes.ok) {
          const data = await watchRes.json()
          setWatchlist(data.items || [])
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
    <div className="grid md:grid-cols-2 gap-4">
      <ListCard
        title="Mes favoris"
        icon={Heart}
        iconColor="text-rose-500"
        href="/mes-favoris"
        items={favorites}
        emptyMessage="Pas encore de favoris"
        loading={loading}
      />
      <ListCard
        title="Ma liste à voir"
        icon={Bookmark}
        iconColor="text-amber-500"
        href="/ma-liste"
        items={watchlist}
        emptyMessage="Pas encore de films à voir"
        loading={loading}
      />
    </div>
  )
}
