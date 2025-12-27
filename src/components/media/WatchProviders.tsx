"use client"

import { useState } from "react"
import Image from "next/image"
import { ExternalLink, YoutubeIcon, ChevronDown, ChevronUp, Play, ShoppingCart, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TMDBWatchProviderResult, TMDBVideo } from "@/lib/tmdb"
import { getProviderLogoUrl } from "@/lib/tmdb"

interface WatchProvidersProps {
  providers: TMDBWatchProviderResult | null
  trailer: TMDBVideo | null
  className?: string
}

export function WatchProviders({ providers, trailer, className = "" }: WatchProvidersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Collect streaming providers for preview
  const streamingProviders = providers?.flatrate || []
  const freeProviders = providers?.free || []
  const previewProviders = [...streamingProviders, ...freeProviders].slice(0, 3)

  const hasProviders = streamingProviders.length > 0 ||
    freeProviders.length > 0 ||
    (providers?.rent?.length || 0) > 0 ||
    (providers?.buy?.length || 0) > 0

  if (!hasProviders && !trailer) {
    return null
  }

  return (
    <div className={`${className}`}>
      {/* Compact row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Trailer Button */}
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
              <YoutubeIcon className="h-4 w-4" />
              Bande-annonce
            </Button>
          </a>
        )}

        {/* Streaming Providers Preview */}
        {previewProviders.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-xs text-gray-400">Disponible sur</span>
            <div className="flex -space-x-1">
              {previewProviders.map((provider) => (
                <div
                  key={provider.provider_id}
                  className="w-8 h-8 rounded-lg overflow-hidden bg-white shadow-sm ring-2 ring-gray-800"
                  title={provider.provider_name}
                >
                  <Image
                    src={getProviderLogoUrl(provider.logo_path, "w92")}
                    alt={provider.provider_name}
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            {hasProviders && (
              <span className="flex items-center text-xs text-gray-400">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Expanded Section */}
      {isExpanded && hasProviders && (
        <div className="mt-4 p-4 bg-white/5 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Streaming (Subscription) */}
          {streamingProviders.length > 0 && (
            <ProviderRow
              title="Abonnement"
              icon={<Play className="h-3.5 w-3.5" />}
              providers={streamingProviders}
              color="text-green-400"
            />
          )}

          {/* Free */}
          {freeProviders.length > 0 && (
            <ProviderRow
              title="Gratuit"
              icon={<Gift className="h-3.5 w-3.5" />}
              providers={freeProviders}
              color="text-blue-400"
            />
          )}

          {/* Rent */}
          {providers?.rent && providers.rent.length > 0 && (
            <ProviderRow
              title="Location"
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              providers={providers.rent}
              color="text-amber-400"
            />
          )}

          {/* Buy */}
          {providers?.buy && providers.buy.length > 0 && (
            <ProviderRow
              title="Achat"
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              providers={providers.buy}
              color="text-purple-400"
            />
          )}

          {/* JustWatch Attribution */}
          {providers?.link && (
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors pt-2 border-t border-white/10"
            >
              <ExternalLink className="h-3 w-3" />
              Voir tous les détails sur JustWatch
            </a>
          )}
        </div>
      )}
    </div>
  )
}

interface ProviderRowProps {
  title: string
  icon: React.ReactNode
  providers: { logo_path: string; provider_name: string; provider_id: number }[]
  color: string
}

function ProviderRow({ title, icon, providers, color }: ProviderRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color} min-w-[90px]`}>
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <div
            key={provider.provider_id}
            className="group relative"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-110">
              <Image
                src={getProviderLogoUrl(provider.logo_path, "w92")}
                alt={provider.provider_name}
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {provider.provider_name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Legacy export for compatibility
export const WatchProvidersCompact = WatchProviders
