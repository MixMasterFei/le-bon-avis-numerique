"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { type MockMediaItem } from "@/lib/mock-data"

interface DbMovie {
  id: string
  title: string
  originalTitle?: string
  synopsisFr?: string
  posterUrl: string
  releaseDate?: string
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  contentMetrics?: any
}

function mapDbToMockFormat(movie: DbMovie): MockMediaItem {
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
    platforms: movie.platforms || [],
    topics: movie.topics || [],
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

// French streaming services with their brand colors
const streamingServices = [
  {
    id: "netflix",
    name: "Netflix",
    logo: "/streaming/netflix.svg",
    color: "bg-red-600",
    hoverColor: "hover:bg-red-700",
    textColor: "text-red-600",
  },
  {
    id: "disney",
    name: "Disney+",
    logo: "/streaming/disney.svg",
    color: "bg-blue-700",
    hoverColor: "hover:bg-blue-800",
    textColor: "text-blue-700",
  },
  {
    id: "prime",
    name: "Prime Video",
    logo: "/streaming/prime.svg",
    color: "bg-cyan-600",
    hoverColor: "hover:bg-cyan-700",
    textColor: "text-cyan-600",
  },
  {
    id: "canal",
    name: "Canal+",
    logo: "/streaming/canal.svg",
    color: "bg-black",
    hoverColor: "hover:bg-gray-800",
    textColor: "text-gray-900",
  },
  {
    id: "arte",
    name: "Arte",
    logo: "/streaming/arte.svg",
    color: "bg-orange-500",
    hoverColor: "hover:bg-orange-600",
    textColor: "text-orange-500",
  },
]

export function StreamingSection() {
  const [selectedService, setSelectedService] = useState(streamingServices[0])
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMovies() {
      setLoading(true)
      try {
        // Fetch movies available on the selected streaming platform
        // Filter by family-friendly content (maxAge=12)
        const res = await fetch(
          `/api/db/movies?limit=6&maxAge=12&platforms=${selectedService.name}&requirePoster=true&minQuality=50`
        )
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.movies)) {
          setMovies(data.movies.map(mapDbToMockFormat))
        } else {
          setMovies([])
        }
      } catch (error) {
        console.error("Failed to fetch streaming movies:", error)
        setMovies([])
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [selectedService])

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
              Films adaptes aux enfants sur vos plateformes
            </p>
          </div>
        </div>
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

      {/* Content area */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {movies.map((item) => (
              <MediaCard key={item.id} media={item} variant="compact" />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Button variant="outline" asChild>
              <Link href={`/films?platforms=${selectedService.name}`}>
                Voir tout sur {selectedService.name} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <p className="text-gray-500">
            Pas encore de films indexes pour {selectedService.name}.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Nous ajoutons regulierement de nouveaux contenus.
          </p>
        </div>
      )}
    </div>
  )
}
