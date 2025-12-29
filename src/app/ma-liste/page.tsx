"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Bookmark, Loader2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import type { MockMediaItem } from "@/lib/mock-data"

export default function MaListePage() {
  const { data: session, status } = useSession()
  const [watchlist, setWatchlist] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await fetch("/api/user/watchlist")
        if (!res.ok) throw new Error("Erreur lors du chargement")
        const data = await res.json()
        setWatchlist(data.watchlist || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue")
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchWatchlist()
    }
  }, [session])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-500 rounded-xl text-white">
            <Bookmark className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ma Liste a Voir</h1>
        </div>
        <p className="text-gray-600">
          Les films, series et jeux que vous souhaitez regarder plus tard.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          <p>{error}</p>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bookmark className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl font-medium mb-2">Aucun contenu dans votre liste</p>
          <p className="text-sm">
            Parcourez le catalogue et cliquez sur le signet pour ajouter des contenus a voir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {watchlist.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      )}
    </div>
  )
}
