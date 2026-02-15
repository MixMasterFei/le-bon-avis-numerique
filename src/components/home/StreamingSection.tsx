"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Play, RefreshCw, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { type MockMediaItem } from "@/lib/mock-data"

interface StreamingMovie {
  id: string
  title: string
  originalTitle?: string
  synopsisFr?: string
  posterUrl: string
  releaseDate?: string
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  contentMetrics?: any
  streaming?: {
    provider: string
    type: string
    link?: string
    lastChecked?: string
  }
}

function mapToMockFormat(movie: StreamingMovie): MockMediaItem {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    type: "MOVIE",
    releaseDate: movie.releaseDate ?? null,
    posterUrl: movie.posterUrl || "/placeholder-poster.jpg",
    synopsisFr: movie.synopsisFr ?? null,
    officialRating: null,
    expertAgeRec: movie.expertAgeRec ?? null,
    communityAgeRec: movie.communityAgeRec ?? null,
    genres: movie.genres || [],
    platforms: movie.streaming ? [movie.streaming.provider] : [],
    topics: [],
    contentMetrics: movie.contentMetrics || {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 0,
      roleModels: 0,
      whatParentsNeedToKnow: [],
    },
    reviews: [],
  }
}

// French streaming services with their brand colors and TMDB provider names
// filterName must match the filter sidebar platform names exactly for pre-selection
const streamingServices = [
  {
    id: "netflix",
    name: "Netflix",
    searchName: "Netflix", // TMDB API search term
    filterName: "Netflix France", // Filter sidebar name
    color: "bg-red-600",
    hoverColor: "hover:bg-red-700",
    textColor: "text-red-600",
  },
  {
    id: "disney",
    name: "Disney+",
    searchName: "Disney Plus",
    filterName: "Disney+",
    color: "bg-blue-700",
    hoverColor: "hover:bg-blue-800",
    textColor: "text-blue-700",
  },
  {
    id: "prime",
    name: "Prime Video",
    searchName: "Amazon Prime Video",
    filterName: "Prime Video",
    color: "bg-cyan-600",
    hoverColor: "hover:bg-cyan-700",
    textColor: "text-cyan-600",
  },
  {
    id: "canal",
    name: "Canal+",
    searchName: "Canal",
    filterName: "Canal+",
    color: "bg-black",
    hoverColor: "hover:bg-gray-800",
    textColor: "text-gray-900",
  },
]

export function StreamingSection() {
  const [selectedService, setSelectedService] = useState(streamingServices[0])
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [totalAvailable, setTotalAvailable] = useState(0)

  useEffect(() => {
    async function fetchMovies() {
      setLoading(true)
      try {
        // Fetch 5 family-friendly movies from the streaming availability table
        // Using maxAge=10 for truly family-friendly content (same as Expert Picks)
        const res = await fetch(
          `/api/db/streaming?provider=${encodeURIComponent(selectedService.searchName)}&limit=5&maxAge=10&type=SUBSCRIPTION&shuffle=weekly&language=fr,en`
        )
        if (!res.ok) throw new Error("API error")
        const data = await res.json()

        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapToMockFormat))
          setTotalAvailable(data.total || data.movies.length)
          if (data.lastUpdated) {
            setLastUpdated(new Date(data.lastUpdated))
          }
        } else {
          setMovies([])
          setTotalAvailable(0)
        }
      } catch (error) {
        console.error("Failed to fetch streaming movies:", error)
        setMovies([])
        setTotalAvailable(0)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [selectedService])

  // Format last updated date
  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return "Mis à jour il y a moins d'une heure"
    if (diffHours < 24) return `Mis à jour il y a ${diffHours}h`
    if (diffDays === 1) return "Mis à jour hier"
    if (diffDays <= 7) return `Mis à jour il y a ${diffDays} jours`
    return "Données en cours de mise à jour"
  }

  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > 7 * 24 * 60 * 60 * 1000

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white">
            <Play className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              Quoi regarder ce soir ?
            </h2>
            <p className="text-gray-600 text-sm">
              Films pour toute la famille sur vos plateformes
            </p>
          </div>
        </div>
        {lastUpdated && (
          <div className={`flex items-center gap-1 text-xs ${isStale ? "text-amber-500" : "text-gray-400"}`}>
            {isStale ? <RefreshCw className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            <span>{formatLastUpdated(lastUpdated)}</span>
          </div>
        )}
      </div>

      {/* Streaming service tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {streamingServices.map((service) => (
          <button
            key={service.id}
            onClick={() => setSelectedService(service)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap
              transition-all duration-200
              ${
                selectedService.id === service.id
                  ? `${service.color} text-white shadow-md`
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            <span>{service.name}</span>
          </button>
        ))}
      </div>

      {/* Content area - always 5 suggestions */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {movies.map((item) => (
              <MediaCard key={item.id} media={item} variant="compact" />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {totalAvailable} films disponibles sur {selectedService.name}
            </span>
            <Button variant="outline" asChild>
              <Link href={`/films/recherche?platforms=${encodeURIComponent(selectedService.filterName)}&maxAge=10`}>
                Voir tout sur {selectedService.name} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">
            Pas encore de données pour {selectedService.name}.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Les données de streaming sont mises à jour quotidiennement.
          </p>
        </div>
      )}
    </div>
  )
}
