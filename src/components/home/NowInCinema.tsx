"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clapperboard, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import type { MediaItem as MockMediaItem } from "@/lib/types"

interface CinemaMovie {
  id: string
  tmdbId: number
  title: string
  originalTitle?: string
  posterUrl: string
  releaseDate?: string
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  topics?: string[]
  toneTags?: string[]
  inDatabase: boolean
}

function mapToMediaItem(movie: CinemaMovie): MockMediaItem {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    type: "MOVIE",
    releaseDate: movie.releaseDate ?? null,
    posterUrl: movie.posterUrl || "/placeholder-poster.jpg",
    synopsisFr: null,
    officialRating: null,
    expertAgeRec: movie.expertAgeRec ?? null,
    communityAgeRec: movie.communityAgeRec ?? null,
    genres: movie.genres || [],
    platforms: [],
    topics: movie.topics || [],
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
    toneTags: movie.toneTags || [],
  }
}

export function NowInCinema({ showLoginHint = false }: { showLoginHint?: boolean }) {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const { getFamilyFit, registerMediaId } = useFamilyFit()

  useEffect(() => {
    async function fetchMovies() {
      try {
        const res = await fetch("/api/cinema")
        if (!res.ok) throw new Error("Cinema API error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          // Take only 7 for a single row on desktop
          setMovies(data.movies.slice(0, 7).map(mapToMediaItem))
        }
      } catch (error) {
        console.error("Failed to fetch cinema movies:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [])

  // Register media IDs for family fit scoring
  useEffect(() => {
    movies.forEach((m) => registerMediaId(m.id))
  }, [movies, registerMediaId])

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
              À l&apos;affiche au cinéma en France
            </h2>
            <p className="text-gray-600 text-sm">
              Les sorties importantes en salle, avec nos repères d&apos;âge et d&apos;attention
            </p>
            {showLoginHint && (
              <Link href="/connexion" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 mt-0.5">
                <Lock className="h-3 w-3" />
                Connectez-vous pour des recommandations personnalisées
              </Link>
            )}
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
          <MediaCard key={item.id} media={item} familyFit={getFamilyFit(item.id)} />
        ))}
      </div>
    </>
  )
}
