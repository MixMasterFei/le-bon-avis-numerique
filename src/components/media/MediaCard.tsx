"use client"

import Link from "next/link"

import { Film, Tv, Gamepad2, BookOpen, Smartphone, Star, AlertTriangle, Heart, Swords } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "./AgeBadge"
import { SafetyBar } from "./ContentGrid"
import { PlatformIcons } from "./PlatformIcons"
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
  variant?: "default" | "compact"
}

// Star rating component
function StarRating({ score, max = 5 }: { score: number; max?: number }) {
  const stars = []
  const fullStars = Math.floor(score)
  const hasHalf = score - fullStars >= 0.5

  for (let i = 0; i < max; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
      )
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <Star key={i} className="h-3 w-3 fill-amber-400/50 text-amber-400" />
      )
    } else {
      stars.push(
        <Star key={i} className="h-3 w-3 text-gray-300" />
      )
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>
}

// Get content warning tags based on metrics
function getContentTags(metrics: MockMediaItem["contentMetrics"]): { label: string; color: string }[] {
  if (!metrics) return []

  const tags: { label: string; color: string }[] = []

  // High violence
  if (metrics.violence >= 4) {
    tags.push({ label: "Violence", color: "bg-red-100 text-red-700" })
  }
  // Positive messages
  if (metrics.positiveMessages >= 4) {
    tags.push({ label: "Educatif", color: "bg-emerald-100 text-emerald-700" })
  }
  // Good role models
  if (metrics.roleModels >= 4) {
    tags.push({ label: "Modeles+", color: "bg-blue-100 text-blue-700" })
  }
  // Language issues
  if (metrics.language >= 4) {
    tags.push({ label: "Langage", color: "bg-orange-100 text-orange-700" })
  }
  // Sex/Nudity
  if (metrics.sexNudity >= 3) {
    tags.push({ label: "Scenes intimes", color: "bg-pink-100 text-pink-700" })
  }

  return tags.slice(0, 2) // Max 2 tags
}

// Calculate quality score from content metrics (0-5 stars)
// This represents "family-friendly quality" - balancing positive values vs concerning content
function calculateQualityScore(metrics: MockMediaItem["contentMetrics"]): number {
  if (!metrics) return 0

  // Positive factors (0-5 each, higher is better)
  const positiveMessages = metrics.positiveMessages || 0
  const roleModels = metrics.roleModels || 0

  // Negative factors (0-5 each, higher is worse for families)
  const violence = metrics.violence || 0
  const sexNudity = metrics.sexNudity || 0
  const language = metrics.language || 0
  const substanceUse = metrics.substanceUse || 0

  // Calculate positive score (average of positive factors)
  const positiveAvg = (positiveMessages + roleModels) / 2

  // Calculate penalty from negative factors (weighted)
  // Violence and sex/nudity are weighted more heavily
  const negativePenalty = (violence * 0.3 + sexNudity * 0.3 + language * 0.2 + substanceUse * 0.2) / 5

  // Final score: positive average minus penalty, scaled to 0-5
  // Only show stars if we have meaningful data (at least some positive metrics)
  if (positiveMessages === 0 && roleModels === 0) return 0

  const score = Math.max(0, positiveAvg - negativePenalty)
  return Math.round(score * 10) / 10
}

export function MediaCard({ media, className, variant = "default" }: MediaCardProps) {
  const Icon = typeIcons[media.type]
  const qualityScore = calculateQualityScore(media.contentMetrics)
  const contentTags = getContentTags(media.contentMetrics)

  // Compact variant - just poster and minimal info (for grids with many items)
  if (variant === "compact") {
    return (
      <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
        <div className={cn("group overflow-hidden transition-all duration-300 h-full", className)}>
          <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
            <SafeImage
              fallbackClassName="absolute inset-0"
              src={media.posterUrl}
              alt={media.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
            />
            <div className="absolute top-1 left-1">
              <AgeBadge age={media.expertAgeRec} size="xs" />
            </div>
          </div>
          <div className="pt-1.5 px-0.5">
            <h3 className="font-medium text-xs text-gray-900 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {media.title}
            </h3>
            {/* Platform icons for games */}
            {media.type === "GAME" && media.platforms.length > 0 && (
              <PlatformIcons platforms={media.platforms} variant="compact" maxDisplay={3} className="mt-1" />
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <div
        className={cn(
          "group overflow-hidden transition-all duration-300 h-full",
          className
        )}
      >
        {/* Poster Image */}
        <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 rounded-t-lg shadow-sm group-hover:shadow-md transition-shadow">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
          />

          {/* Type Badge - top right */}
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-flex items-center gap-0.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <Icon className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Info Section Below Image */}
        <div className="bg-white rounded-b-lg border border-t-0 border-gray-100 p-2 space-y-1.5">
          {/* Title */}
          <h3 className="font-semibold text-xs text-gray-900 line-clamp-1 group-hover:text-primary transition-colors leading-tight">
            {media.title}
          </h3>

          {/* Ratings Row: Age + Stars */}
          <div className="flex items-center justify-between gap-1">
            {/* Age Badge - Compact inline version */}
            <div className={cn(
              "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white",
              media.expertAgeRec === null || media.expertAgeRec === undefined || media.expertAgeRec === 0
                ? "bg-gray-400"
                : media.expertAgeRec <= 3
                ? "bg-emerald-500"
                : media.expertAgeRec <= 7
                ? "bg-emerald-600"
                : media.expertAgeRec <= 10
                ? "bg-amber-500"
                : media.expertAgeRec <= 13
                ? "bg-orange-500"
                : "bg-red-500"
            )}>
              {media.expertAgeRec && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : "?"}
            </div>

            {/* Quality Stars */}
            {qualityScore > 0 && <StarRating score={qualityScore} />}
          </div>

          {/* Content Tags */}
          {contentTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contentTags.map((tag, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                    tag.color
                  )}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// Horizontal variant for lists
export function MediaCardHorizontal({ media, className }: MediaCardProps) {
  const Icon = typeIcons[media.type]
  const qualityScore = calculateQualityScore(media.contentMetrics)
  const contentTags = getContentTags(media.contentMetrics)

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
                  {qualityScore > 0 && <StarRating score={qualityScore} />}
                </div>
              </div>
              <AgeBadge age={media.expertAgeRec} size="sm" />
            </div>

            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {media.synopsisFr}
            </p>

            {/* Content Tags */}
            {contentTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {contentTags.map((tag, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      tag.color
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Safety Bar */}
          <SafetyBar metrics={media.contentMetrics} ageRec={media.expertAgeRec} className="mt-3" />
        </div>
      </Card>
    </Link>
  )
}


