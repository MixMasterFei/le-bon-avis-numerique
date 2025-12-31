"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Award, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "@/components/media/AgeBadge"
import { type MockMediaItem } from "@/lib/mock-data"
import { toMediaRouteId } from "@/lib/media-route"

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
  dataQualityScore?: number
}

function mapDbToMockFormat(movie: DbMovie): MockMediaItem & { qualityScore?: number } {
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
    qualityScore: movie.dataQualityScore,
  }
}

// Expert Pick Card with special badge
function ExpertPickCard({ media }: { media: MockMediaItem }) {
  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <div className="group relative">
        {/* Card with poster */}
        <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 rounded-lg shadow-md group-hover:shadow-xl transition-all duration-300">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          />

          {/* Expert Selection Badge - Top corner ribbon style */}
          <div className="absolute -top-1 -right-1">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-2 py-1 rounded-bl-lg rounded-tr-lg shadow-lg">
              <div className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span className="text-[10px] font-bold">EXPERT</span>
              </div>
            </div>
          </div>

          {/* Age Badge */}
          <div className="absolute top-1 left-1">
            <AgeBadge age={media.expertAgeRec} size="xs" />
          </div>

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Title overlay */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-lg">
              {media.title}
            </h3>
            {media.genres && media.genres.length > 0 && (
              <p className="text-white/80 text-xs mt-1 line-clamp-1">
                {media.genres.slice(0, 2).join(" • ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ExpertPicks() {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMovies() {
      try {
        // Fetch high-quality family-friendly content
        // These are the expert's top picks - best quality scores, family-friendly
        const res = await fetch("/api/db/movies?limit=5&maxAge=12&requirePoster=true&minQuality=70&sortBy=quality")
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error("Failed to fetch expert picks:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (movies.length === 0) {
    return null
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
                Selection Expert
              </h2>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Star className="h-3 w-3 mr-1 fill-emerald-500" />
                Top qualite
              </Badge>
            </div>
            <p className="text-gray-600 text-sm">
              Nos recommandations pour toute la famille
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="hidden sm:inline-flex border-emerald-200 hover:bg-emerald-50">
          <Link href="/films?quality=high">
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {movies.map((item) => (
          <ExpertPickCard key={item.id} media={item} />
        ))}
      </div>

      {/* Mobile CTA */}
      <div className="mt-6 text-center sm:hidden">
        <Button variant="outline" asChild className="border-emerald-200 hover:bg-emerald-50">
          <Link href="/films?quality=high">
            Voir toutes les selections <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
