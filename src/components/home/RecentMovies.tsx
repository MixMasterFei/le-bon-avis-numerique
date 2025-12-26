"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
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

export function RecentMovies() {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMovies() {
      try {
        // Fetch recently added movies from database
        const res = await fetch("/api/db/movies?limit=8")
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error("Failed to fetch recent movies:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (movies.length === 0) {
    return null // Don't show section if no movies
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Récemment évalués
          </h2>
          <p className="text-gray-600 mt-1">
            Les dernières critiques de notre équipe
          </p>
        </div>
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/films">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
        {movies.map((item) => (
          <MediaCard key={item.id} media={item} />
        ))}
      </div>
    </>
  )
}
