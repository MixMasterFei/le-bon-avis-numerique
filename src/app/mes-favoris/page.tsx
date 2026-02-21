"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Heart, Loader2, Trash2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { Button } from "@/components/ui/button"
import type { MockMediaItem } from "@/lib/mock-data"

export default function MesFavorisPage() {
  const { data: session, status } = useSession()
  const [favorites, setFavorites] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await fetch("/api/user/favorites")
        if (!res.ok) throw new Error("Erreur lors du chargement")
        const data = await res.json()
        setFavorites(data.favorites || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue")
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchFavorites()
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
          <div className="p-3 bg-red-500 rounded-xl text-white">
            <Heart className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Favoris</h1>
        </div>
        <p className="text-gray-600">
          Les films, series et jeux que vous avez marques comme favoris.
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
      ) : favorites.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Heart className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl font-medium mb-2">Aucun favori pour le moment</p>
          <p className="text-sm">
            Parcourez le catalogue et cliquez sur le coeur pour ajouter des favoris.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {favorites.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      )}
    </div>
  )
}
