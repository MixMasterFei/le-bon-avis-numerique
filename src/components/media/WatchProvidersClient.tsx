"use client"

import { WatchProviders } from "@/components/media/WatchProviders"
import { useExtrasData } from "@/components/media/FicheDataContext"

interface WatchProvidersClientProps {
  mediaId: string | null
  mediaType: string
  className?: string
}

export function WatchProvidersClient({ mediaId, mediaType, className }: WatchProvidersClientProps) {
  // Shared with the dashboard bar via FicheDataProvider when present; falls
  // back to its own fetch on pages without the provider (e.g. /apercufilm).
  const { data, loading } = useExtrasData(mediaId, mediaType)

  // Don't render anything for games/books
  if (mediaType !== "MOVIE" && mediaType !== "TV") return null

  // Skeleton while loading
  if (loading) {
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

  const providers = data?.watchProviders ?? null
  const trailer = data?.trailer ?? null
  const inTheaters = Boolean(data?.inTheaters)

  // Render providers + trailer (or nothing if all empty)
  if (!providers && !trailer && !inTheaters) return null

  return <WatchProviders providers={providers} trailer={trailer} inTheaters={inTheaters} className={className} />
}
