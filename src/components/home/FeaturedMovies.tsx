"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import type { MediaItem, MediaItem as MockMediaItem } from "@/lib/types"

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
  contentMetrics?: MediaItem["contentMetrics"] | null
  toneTags?: string[]
  pacing?: string
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
    toneTags: movie.toneTags || [],
    pacing: movie.pacing || undefined,
  }
}

export function FeaturedMovies({ showLoginHint = false }: { showLoginHint?: boolean }) {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const { getFamilyFit, registerMediaId } = useFamilyFit()

  useEffect(() => {
    async function fetchMovies() {
      try {
        const familyGenres = encodeURIComponent("Animation,Famille")
        const excludeGenres = encodeURIComponent("Romance,Drame,Horreur,Thriller,Crime,Guerre")
        const res = await fetch(`/api/db/movies?limit=14&maxAge=7&genres=${familyGenres}&excludeGenres=${excludeGenres}&requirePoster=true&minQuality=70&shuffle=weekly&language=fr,en`)
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()

        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapDbToMockFormat))
        } else {
          const fallbackRes = await fetch("/api/db/movies?limit=14&maxAge=10&language=fr,en")
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json()
            if (Array.isArray(fallbackData?.movies)) {
              setMovies(fallbackData.movies.map(mapDbToMockFormat))
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch featured movies:", error)
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
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (movies.length === 0 && !loading) {
    return null
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Films pour les enfants
          </h2>
          <p className="text-gray-600 mt-1">
            Des films adaptés aux plus jeunes, analysés pour chaque âge
          </p>
          {showLoginHint && (
            <Link href="/connexion" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 mt-0.5">
              <Lock className="h-3 w-3" />
              Connectez-vous pour des recommandations personnalisées
            </Link>
          )}
        </div>
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/films?maxAge=7">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {movies.map((item) => (
          <MediaCard key={item.id} media={item} familyFit={getFamilyFit(item.id)} />
        ))}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Button variant="outline" asChild>
          <Link href="/films?maxAge=7">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  )
}
