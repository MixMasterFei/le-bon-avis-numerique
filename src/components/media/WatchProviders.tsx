"use client"

import Image from "next/image"
import { ExternalLink, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TMDBWatchProviderResult, TMDBVideo } from "@/lib/tmdb"
import { getProviderLogoUrl } from "@/lib/tmdb"

interface WatchProvidersProps {
  providers: TMDBWatchProviderResult | null
  trailer: TMDBVideo | null
  className?: string
}

export function WatchProviders({ providers, trailer, className = "" }: WatchProvidersProps) {
  // Collect all streaming providers (prioritize flatrate/subscription)
  const streamingProviders = providers?.flatrate || []
  const allProviders = [
    ...streamingProviders,
    ...(providers?.free || []),
  ]

  // Get unique providers for display (max 4)
  const displayProviders = allProviders.slice(0, 4)
  const hasMoreProviders = allProviders.length > 4 || (providers?.rent?.length || 0) > 0 || (providers?.buy?.length || 0) > 0

  if (!displayProviders.length && !trailer) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Trailer Button - Compact */}
      {trailer && (
        <a
          href={`https://www.youtube.com/watch?v=${trailer.key}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5 h-8"
          >
            <Youtube className="h-4 w-4" />
            Bande-annonce
          </Button>
        </a>
      )}

      {/* Streaming Providers - Inline */}
      {displayProviders.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Disponible sur</span>
          <div className="flex -space-x-1">
            {displayProviders.map((provider) => (
              <div
                key={provider.provider_id}
                className="w-7 h-7 rounded-md overflow-hidden bg-white shadow-sm ring-2 ring-gray-800 hover:z-10 hover:scale-110 transition-transform"
                title={provider.provider_name}
              >
                <Image
                  src={getProviderLogoUrl(provider.logo_path, "w45")}
                  alt={provider.provider_name}
                  width={28}
                  height={28}
                  className="object-cover"
                />
              </div>
            ))}
            {hasMoreProviders && (
              <div className="w-7 h-7 rounded-md bg-gray-700 flex items-center justify-center text-[10px] text-gray-300 ring-2 ring-gray-800">
                +
              </div>
            )}
          </div>
        </div>
      )}

      {/* JustWatch link */}
      {providers?.link && (
        <a
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Voir sur JustWatch
        </a>
      )}
    </div>
  )
}

// Legacy export for compatibility (now just uses the main component)
export const WatchProvidersCompact = WatchProviders
