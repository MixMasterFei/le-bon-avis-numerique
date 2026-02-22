"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clapperboard } from "lucide-react"
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

export function NowInCinema() {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMovies() {
      try {
        const res = await fetch(
          "/api/db/movies?limit=14&nowPlaying=true&requirePoster=true&sortBy=releaseDate"
        )
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error("Failed to fetch now playing movies:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (movies.length === 0) {
    return null
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl text-white">
            <Clapperboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              En ce moment au cinema
            </h2>
            <p className="text-gray-600 text-sm">
              Les films actuellement en salle, avec nos recommandations par age
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/films?sort=cinema">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {movies.map((item) => (
          <MediaCard key={item.id} media={item} />
        ))}
      </div>
    </>
  )
}
