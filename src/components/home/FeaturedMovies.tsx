"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

interface ApiMovie {
  id: string
  title: string
  originalTitle?: string
  synopsisFr?: string
  posterUrl: string
  releaseDate?: string
  rating?: number
  type: "MOVIE"
}

function mapApiToMockFormat(movie: ApiMovie): MockMediaItem {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    type: "MOVIE",
    releaseDate: movie.releaseDate ?? null,
    posterUrl: movie.posterUrl,
    synopsisFr: movie.synopsisFr ?? null,
    officialRating: null,
    expertAgeRec: null,
    communityAgeRec: movie.rating ?? null,
    genres: [],
    platforms: [],
    topics: [],
    contentMetrics: {
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

export function FeaturedMovies() {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<"api" | "mock">("mock")

  useEffect(() => {
    async function fetchMovies() {
      try {
        const res = await fetch("/api/movies/family?page=1")
        if (!res.ok) throw new Error("API error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.slice(0, 4).map(mapApiToMockFormat))
          setSource("api")
        } else {
          throw new Error("No movies")
        }
      } catch {
        setMovies(mockMediaItems.filter(m => m.type === "MOVIE").slice(0, 4))
        setSource("mock")
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {source === "api" ? "Films populaires pour la famille" : "Selection de nos experts"}
          </h2>
          <p className="text-gray-600 mt-1">
            {source === "api"
              ? "Les meilleurs films familiaux du moment"
              : "Des choix de qualite recommandes par notre equipe"}
          </p>
        </div>
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/films">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {movies.map((item) => (
          <MediaCard key={item.id} media={item} />
        ))}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Button variant="outline" asChild>
          <Link href="/films">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  )
}
