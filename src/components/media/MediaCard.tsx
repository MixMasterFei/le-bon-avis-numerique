"use client"

import Link from "next/link"

import { Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "./AgeBadge"
import { SafetyBar } from "./ContentGrid"
import { cn, mediaTypeLabels } from "@/lib/utils"
import type { MockMediaItem } from "@/lib/mock-data"
import { toMediaRouteId } from "@/lib/media-route"

const typeIcons = {
  MOVIE: Film,
  TV: Tv,
  GAME: Gamepad2,
  BOOK: BookOpen,
  APP: Smartphone,
}

interface MediaCardProps {
  media: MockMediaItem
  className?: string
}

export function MediaCard({ media, className }: MediaCardProps) {
  const Icon = typeIcons[media.type]

  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <div
        className={cn(
          "group overflow-hidden transition-all duration-300 h-full",
          className
        )}
      >
        {/* Poster Image */}
        <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
          />

          {/* Age Badge Overlay */}
          <div className="absolute top-1 left-1">
            <AgeBadge age={media.expertAgeRec} size="xs" />
          </div>

          {/* Type Badge - only icon on mobile */}
          <div className="absolute top-1 right-1">
            <span className="inline-flex items-center gap-0.5 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded">
              <Icon className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Title only - minimal */}
        <div className="pt-1.5 px-0.5">
          <h3 className="font-medium text-xs text-gray-900 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {media.title}
          </h3>
        </div>
      </div>
    </Link>
  )
}

// Horizontal variant for lists
export function MediaCardHorizontal({ media, className }: MediaCardProps) {
  const Icon = typeIcons[media.type]

  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <Card
        className={cn(
          "group flex overflow-hidden hover:shadow-lg transition-all duration-300",
          className
        )}
      >
        {/* Poster */}
        <div className="relative w-24 sm:w-32 shrink-0 aspect-[2/3] overflow-hidden bg-gray-100">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover"
            sizes="128px"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                  {media.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Icon className="h-3 w-3" />
                    {mediaTypeLabels[media.type]}
                  </Badge>
                </div>
              </div>
              <AgeBadge age={media.expertAgeRec} size="sm" />
            </div>

            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {media.synopsisFr}
            </p>
          </div>

          {/* Safety Bar */}
          <SafetyBar metrics={media.contentMetrics} ageRec={media.expertAgeRec} className="mt-3" />
        </div>
      </Card>
    </Link>
  )
}


