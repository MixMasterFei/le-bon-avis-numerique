"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Award, Film, Gamepad2, RefreshCw, Star, Tv } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "@/components/media/AgeBadge"
import { toMediaRouteId } from "@/lib/media-route"

interface ExpertPickItem {
  id: string
  title: string
  originalTitle?: string
  type: "MOVIE" | "TV" | "GAME"
  posterUrl: string
  genres: string[]
  expertAgeRec: number | null
  communityAgeRec: number | null
  tmdbRating: number | null
  dataQualityScore: number
  releaseDate: string | null
}

const typeLabels: Record<string, { label: string; icon: typeof Film }> = {
  MOVIE: { label: "Film", icon: Film },
  TV: { label: "Série", icon: Tv },
  GAME: { label: "Jeu", icon: Gamepad2 },
}

function ExpertPickCard({ item }: { item: ExpertPickItem }) {
  const typeInfo = typeLabels[item.type] || typeLabels.MOVIE
  const TypeIcon = typeInfo.icon

  return (
    <Link href={`/media/${toMediaRouteId(item.type, item.id)}`}>
      <div className="group relative">
        <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 rounded-lg shadow-md group-hover:shadow-xl transition-all duration-300">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />

          {/* Expert badge */}
          <div className="absolute -top-1 -right-1">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-2 py-1 rounded-bl-lg rounded-tr-lg shadow-lg">
              <div className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span className="text-[10px] font-bold">EXPERT</span>
              </div>
            </div>
          </div>

          {/* Age badge */}
          <div className="absolute top-1 left-1">
            <AgeBadge age={item.expertAgeRec} size="xs" />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Title + type overlay */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-lg">
              {item.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/20 text-white backdrop-blur-sm px-1.5 py-0.5 rounded">
                <TypeIcon className="h-2.5 w-2.5" />
                {typeInfo.label}
              </span>
              {item.genres.length > 0 && (
                <span className="text-white/70 text-xs line-clamp-1">
                  {item.genres[0]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ExpertPicks() {
  const [items, setItems] = useState<ExpertPickItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPicks = useCallback(async (seed?: number) => {
    try {
      const params = new URLSearchParams({ limit: "6" })
      if (seed !== undefined) params.set("seed", String(seed))
      const res = await fetch(`/api/db/expert-picks?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data?.items) && data.items.length > 0) {
          setItems(data.items)
        }
      }
    } catch (error) {
      console.error("Failed to fetch expert picks:", error)
    }
  }, [])

  useEffect(() => {
    fetchPicks().finally(() => setLoading(false))
  }, [fetchPicks])

  const handleRefresh = async () => {
    setRefreshing(true)
    const randomSeed = Math.floor(Math.random() * 1000000)
    await fetchPicks(randomSeed)
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[2/3] bg-emerald-100/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white shadow-lg">
            <Award className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Sélection Expert</h2>
        </div>
        <p className="text-gray-600 text-sm">
          Nos sélections sont en cours de préparation. Revenez bientôt !
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white shadow-lg">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                Sélection Expert
              </h2>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Star className="h-3 w-3 mr-1 fill-emerald-500" />
                Top qualité
              </Badge>
            </div>
            <p className="text-gray-600 text-sm">
              Films, séries et jeux recommandés pour toute la famille
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-emerald-700 hover:bg-emerald-100"
            title="Nouvelle sélection"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1.5">Autre sélection</span>
          </Button>
          <Button variant="outline" asChild className="hidden sm:inline-flex border-emerald-200 hover:bg-emerald-50">
            <Link href="/recherche">
              Voir tout <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <ExpertPickCard key={item.id} item={item} />
        ))}
      </div>

      {/* Mobile CTA */}
      <div className="mt-6 text-center sm:hidden">
        <Button variant="outline" asChild className="border-emerald-200 hover:bg-emerald-50">
          <Link href="/recherche">
            Voir toutes les sélections <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
