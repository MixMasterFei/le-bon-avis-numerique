"use client"

import Image from "next/image"
import { Play, ShoppingCart, Tv, Gift, ExternalLink, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TMDBWatchProviderResult, TMDBVideo } from "@/lib/tmdb"
import { getProviderLogoUrl } from "@/lib/tmdb"

interface WatchProvidersProps {
  providers: TMDBWatchProviderResult | null
  trailer: TMDBVideo | null
  className?: string
}

export function WatchProviders({ providers, trailer, className = "" }: WatchProvidersProps) {
  const hasProviders = providers && (
    providers.flatrate?.length ||
    providers.rent?.length ||
    providers.buy?.length ||
    providers.free?.length
  )

  if (!hasProviders && !trailer) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Trailer Button */}
      {trailer && (
        <a
          href={`https://www.youtube.com/watch?v=${trailer.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            variant="default"
            size="lg"
            className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
          >
            <Youtube className="h-5 w-5" />
            Voir la bande-annonce
          </Button>
        </a>
      )}

      {/* Watch Providers */}
      {hasProviders && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Tv className="h-4 w-4" />
            Ou regarder en France
          </h3>

          {/* Streaming (Flatrate/Subscription) */}
          {providers.flatrate && providers.flatrate.length > 0 && (
            <ProviderSection
              title="Abonnement"
              providers={providers.flatrate}
              icon={<Play className="h-3.5 w-3.5" />}
              color="text-green-400"
              bgColor="bg-green-500/10"
            />
          )}

          {/* Free */}
          {providers.free && providers.free.length > 0 && (
            <ProviderSection
              title="Gratuit"
              providers={providers.free}
              icon={<Gift className="h-3.5 w-3.5" />}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
          )}

          {/* Rent */}
          {providers.rent && providers.rent.length > 0 && (
            <ProviderSection
              title="Location"
              providers={providers.rent}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              color="text-amber-400"
              bgColor="bg-amber-500/10"
            />
          )}

          {/* Buy */}
          {providers.buy && providers.buy.length > 0 && (
            <ProviderSection
              title="Achat"
              providers={providers.buy}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              color="text-purple-400"
              bgColor="bg-purple-500/10"
            />
          )}

          {/* JustWatch Attribution */}
          {providers.link && (
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Voir sur JustWatch
            </a>
          )}
        </div>
      )}
    </div>
  )
}

interface ProviderSectionProps {
  title: string
  providers: { logo_path: string; provider_name: string; provider_id: number }[]
  icon: React.ReactNode
  color: string
  bgColor: string
}

function ProviderSection({ title, providers, icon, color, bgColor }: ProviderSectionProps) {
  return (
    <div className={`p-3 rounded-lg ${bgColor}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color} mb-2`}>
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.slice(0, 6).map((provider) => (
          <div
            key={provider.provider_id}
            className="group relative"
            title={provider.provider_name}
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-110">
              <Image
                src={getProviderLogoUrl(provider.logo_path)}
                alt={provider.provider_name}
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
          </div>
        ))}
        {providers.length > 6 && (
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xs text-gray-400">
            +{providers.length - 6}
          </div>
        )}
      </div>
    </div>
  )
}

// Compact version for hero section
interface WatchProvidersCompactProps {
  providers: TMDBWatchProviderResult | null
  trailer: TMDBVideo | null
}

export function WatchProvidersCompact({ providers, trailer }: WatchProvidersCompactProps) {
  const hasProviders = providers?.flatrate?.length

  if (!hasProviders && !trailer) {
    return null
  }

  return (
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
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5"
          >
            <Youtube className="h-4 w-4" />
            Bande-annonce
          </Button>
        </a>
      )}

      {/* Streaming Providers Inline */}
      {hasProviders && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Disponible sur</span>
          <div className="flex -space-x-1">
            {providers.flatrate!.slice(0, 4).map((provider) => (
              <div
                key={provider.provider_id}
                className="w-7 h-7 rounded-md overflow-hidden bg-white shadow-sm ring-2 ring-gray-800"
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
            {providers.flatrate!.length > 4 && (
              <div className="w-7 h-7 rounded-md bg-gray-700 flex items-center justify-center text-[10px] text-gray-300 ring-2 ring-gray-800">
                +{providers.flatrate!.length - 4}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
