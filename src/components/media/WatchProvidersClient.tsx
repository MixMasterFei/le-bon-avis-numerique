"use client"

import { useEffect, useState } from "react"
import { WatchProviders } from "@/components/media/WatchProviders"
import type { TMDBWatchProviderResult, TMDBVideo } from "@/lib/tmdb"

interface WatchProvidersClientProps {
  mediaId: string | null
  mediaType: string
  className?: string
}

export function WatchProvidersClient({ mediaId, mediaType, className }: WatchProvidersClientProps) {
  const [providers, setProviders] = useState<TMDBWatchProviderResult | null>(null)
  const [trailer, setTrailer] = useState<TMDBVideo | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!mediaId || (mediaType !== "MOVIE" && mediaType !== "TV")) {
      setLoaded(true)
      return
    }

    let cancelled = false

    async function fetchExtras() {
      try {
        const res = await fetch(`/api/media/${mediaId}/extras`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setProviders(data.watchProviders)
            setTrailer(data.trailer)
          }
        }
      } catch {
        // Silently fail — streaming/trailer are non-critical
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    fetchExtras()
    return () => { cancelled = true }
  }, [mediaId, mediaType])

  // Don't render anything for games/books
  if (mediaType !== "MOVIE" && mediaType !== "TV") return null

  // Skeleton while loading
  if (!loaded) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-10 h-10 rounded-lg bg-white/10" />
          ))}
        </div>
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
    )
  }

  // Render providers + trailer (or nothing if both null)
  if (!providers && !trailer) return null

  return <WatchProviders providers={providers} trailer={trailer} className={className} />
}
