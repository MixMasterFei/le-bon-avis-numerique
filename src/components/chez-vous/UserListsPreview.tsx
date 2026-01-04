"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Bookmark, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="aspect-[2/3] bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Favorites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-pink-500" />
            Mes favoris
          </CardTitle>
          {favorites.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/mes-favoris">
                Voir tout <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Heart className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Pas encore de favoris</p>
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link href="/films">Explorer les films</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {favorites.map((item) => (
                <Link
                  key={item.id}
                  href={`/media/${item.media.id}`}
                  className="group"
                >
                  <div className="aspect-[2/3] rounded overflow-hidden bg-gray-100 relative">
                    {item.media.posterUrl ? (
                      <Image
                        src={item.media.posterUrl}
                        alt={item.media.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        ?
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Watchlist */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bookmark className="h-5 w-5 text-amber-500" />
            Ma liste à voir
          </CardTitle>
          {watchlist.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ma-liste">
                Voir tout <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Pas encore de films à voir</p>
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link href="/films">Explorer les films</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {watchlist.map((item) => (
                <Link
                  key={item.id}
                  href={`/media/${item.media.id}`}
                  className="group"
                >
                  <div className="aspect-[2/3] rounded overflow-hidden bg-gray-100 relative">
                    {item.media.posterUrl ? (
                      <Image
                        src={item.media.posterUrl}
                        alt={item.media.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        ?
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
