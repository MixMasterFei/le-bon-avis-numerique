"use client"

import { useState } from "react"
import Link from "next/link"

import { Film, Tv, Gamepad2, BookOpen, Smartphone, Star, EyeOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "./AgeBadge"
import { SafetyBar } from "./ContentGrid"
import { PlatformIcons } from "./PlatformIcons"
import { cn, mediaTypeLabels } from "@/lib/utils"
import type { MockMediaItem } from "@/lib/mock-data"
import { toMediaRouteId } from "@/lib/media-route"
import { useSettings } from "@/contexts/SettingsContext"

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

// Family-friendliness gauge — compact colored pill (green→red)
function FamilyGauge({ metrics, ageRec }: { metrics: MockMediaItem["contentMetrics"] | null | undefined; ageRec?: number | null }) {
  if (!metrics) return null

  // Use MAX of negative metrics to determine safety level
  const maxNegative = Math.max(
    metrics.violence,
    metrics.sexNudity,
    metrics.language,
    metrics.substanceUse
  )

  // Raise minimum based on age recommendation
  let minScore = 0
  if (ageRec && ageRec >= 16) minScore = 4
  else if (ageRec && ageRec >= 13) minScore = 3
  else if (ageRec && ageRec >= 10) minScore = 2

  const effectiveScore = Math.max(maxNegative, minScore)

  let color: string
  let label: string

  if (effectiveScore <= 1) {
    color = "bg-emerald-100 text-emerald-700"
    label = "Familial"
  } else if (effectiveScore <= 2) {
    color = "bg-emerald-50 text-emerald-600"
    label = "Adapte"
  } else if (effectiveScore <= 3) {
    color = "bg-amber-100 text-amber-700"
    label = "Modere"
  } else if (effectiveScore <= 4) {
    color = "bg-orange-100 text-orange-700"
    label = "Attention"
  } else {
    color = "bg-red-100 text-red-700"
    label = "Mature"
  }

  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", color)}>
      {label}
    </span>
  )
}

// Community star rating — only shown when users have reviewed
function CommunityRating({ avgRating, count }: { avgRating: number; count: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${avgRating}/5 (${count} avis)`}>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-[10px] font-semibold text-gray-600">{avgRating}</span>
      <span className="text-[10px] text-gray-400">({count})</span>
    </div>
  )
}

// Get content warning tags based on metrics
function getContentTags(metrics: MockMediaItem["contentMetrics"]): { label: string; color: string }[] {
  if (!metrics) return []

  const tags: { label: string; color: string }[] = []

  // High violence
  if (metrics.violence >= 4) {
    tags.push({ label: "Violence", color: "bg-red-100 text-red-700" })
  }
  // Truly educational content (5 = central theme, not just "has some positive messages")
  if (metrics.positiveMessages >= 5) {
    tags.push({ label: "Educatif", color: "bg-emerald-100 text-emerald-700" })
  }
  // Exceptional role models
  if (metrics.roleModels >= 5) {
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

export function MediaCard({ media, className, variant = "default" }: MediaCardProps) {
  const Icon = typeIcons[media.type]
  const contentTags = getContentTags(media.contentMetrics)
  const { settings } = useSettings()
  const [isBlurRemoved, setIsBlurRemoved] = useState(false)

  // Check if content should be blurred (18+ age or extreme violence with blur setting enabled)
  const shouldBlur = settings.blur18Plus && (
    (media.expertAgeRec !== null && media.expertAgeRec >= 18) ||
    (media.contentMetrics?.violence !== undefined && media.contentMetrics.violence >= 5)
  )
  const effectiveBlur = shouldBlur && !isBlurRemoved

  // Compact variant - just poster and minimal info (for grids with many items)
  if (variant === "compact") {
    return (
      <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
        <div className={cn("group overflow-hidden transition-all duration-300 h-full", className)}>
          <div className="relative aspect-[2/3] overflow-hidden bg-violet-100 rounded-2xl shadow-md group-hover:shadow-xl group-hover:-translate-y-2 transition-all duration-300">
            <SafeImage
              fallbackClassName="absolute inset-0"
              src={media.posterUrl}
              alt={media.title}
              fill
              className={cn(
                "object-cover group-hover:scale-110 transition-transform duration-500",
                effectiveBlur && "blur-xl scale-110"
              )}
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
            />
            {effectiveBlur && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsBlurRemoved(true)
                }}
                role="button"
                aria-label="Afficher le contenu"
              >
                <div className="bg-black/60 rounded-full p-2">
                  <EyeOff className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-violet-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-2 left-2">
              <AgeBadge age={media.expertAgeRec} size="xs" />
            </div>
          </div>
          <div className="pt-2 px-1">
            <h3 className="font-semibold text-xs text-gray-800 line-clamp-2 group-hover:text-violet-700 transition-colors leading-tight">
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
        {/* Poster Image - Bold rounded corners, dramatic hover */}
        <div className="relative aspect-[2/3] overflow-hidden bg-violet-100 rounded-2xl rounded-br-sm shadow-md group-hover:shadow-2xl group-hover:shadow-violet-200/50 group-hover:-translate-y-2 transition-all duration-300">
          <SafeImage
            fallbackClassName="absolute inset-0"
            src={media.posterUrl}
            alt={media.title}
            fill
            className={cn(
              "object-cover group-hover:scale-110 transition-transform duration-500",
              effectiveBlur && "blur-xl scale-110"
            )}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
          />
          {effectiveBlur && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsBlurRemoved(true)
              }}
              role="button"
              aria-label="Afficher le contenu"
            >
              <div className="bg-black/60 rounded-full p-2">
                <EyeOff className="h-5 w-5 text-white" />
              </div>
            </div>
          )}

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-violet-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Type Badge - top right with gradient */}
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-0.5 bg-gradient-to-br from-violet-600 to-pink-500 text-white text-[10px] px-2 py-1 rounded-full shadow-md">
              <Icon className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Info Section Below Image - Cleaner, bolder */}
        <div className="bg-white rounded-2xl rounded-tr-sm border border-violet-100 -mt-3 relative z-10 p-3 space-y-2 shadow-sm group-hover:shadow-md group-hover:border-violet-200 transition-all duration-300">
          {/* Title */}
          <h3 className="font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-violet-700 transition-colors leading-tight">
            {media.title}
          </h3>

          {/* Ratings Row: Age + Family Gauge + Community Rating */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Age Badge - Playful pill design */}
            <div className={cn(
              "inline-flex items-center justify-center px-2 py-1 rounded-full text-[11px] font-bold text-white shadow-sm",
              media.expertAgeRec === null || media.expertAgeRec === undefined || media.expertAgeRec === 0
                ? "bg-gray-400"
                : media.expertAgeRec <= 3
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : media.expertAgeRec <= 7
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                : media.expertAgeRec <= 10
                ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                : media.expertAgeRec <= 13
                ? "bg-gradient-to-r from-orange-500 to-amber-400"
                : "bg-gradient-to-r from-rose-500 to-red-400"
            )}>
              {media.expertAgeRec && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : "?"}
            </div>

            {/* Family-friendliness gauge */}
            <FamilyGauge metrics={media.contentMetrics} ageRec={media.expertAgeRec} />

            {/* Community score: user reviews preferred, TMDB as fallback */}
            {media.reviewCount && media.reviewCount > 0 && media.reviewAvgRating ? (
              <CommunityRating avgRating={media.reviewAvgRating} count={media.reviewCount} />
            ) : media.tmdbRating && media.tmdbVoteCount ? (
              <CommunityRating avgRating={Math.round((media.tmdbRating / 2) * 10) / 10} count={media.tmdbVoteCount} />
            ) : null}
          </div>

          {/* Content Tags - More colorful pills */}
          {contentTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contentTags.map((tag, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-semibold",
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
  const contentTags = getContentTags(media.contentMetrics)
  const { settings } = useSettings()
  const [isBlurRemoved, setIsBlurRemoved] = useState(false)
  const shouldBlur = settings.blur18Plus && (
    (media.expertAgeRec !== null && media.expertAgeRec >= 18) ||
    (media.contentMetrics?.violence !== undefined && media.contentMetrics.violence >= 5)
  )
  const effectiveBlur = shouldBlur && !isBlurRemoved

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
            className={cn("object-cover", effectiveBlur && "blur-xl scale-110")}
            sizes="128px"
          />
          {effectiveBlur && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsBlurRemoved(true)
              }}
              role="button"
              aria-label="Afficher le contenu"
            >
              <div className="bg-black/60 rounded-full p-1.5">
                <EyeOff className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                  {media.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Icon className="h-3 w-3" />
                    {mediaTypeLabels[media.type]}
                  </Badge>
                  <FamilyGauge metrics={media.contentMetrics} ageRec={media.expertAgeRec} />
                  {media.reviewCount && media.reviewCount > 0 && media.reviewAvgRating ? (
                    <CommunityRating avgRating={media.reviewAvgRating} count={media.reviewCount} />
                  ) : media.tmdbRating && media.tmdbVoteCount ? (
                    <CommunityRating avgRating={Math.round((media.tmdbRating / 2) * 10) / 10} count={media.tmdbVoteCount} />
                  ) : null}
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


