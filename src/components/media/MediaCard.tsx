"use client"

import { useState } from "react"
import Link from "next/link"

import { Film, Tv, Gamepad2, BookOpen, Smartphone, Star, EyeOff, ShieldAlert, Library } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "./AgeBadge"
import { ProvisionalBadge } from "./ProvisionalBadge"
import { FamilyFitAvatars } from "./FamilyFitAvatars"
import { PosterActionBar } from "./PosterActionBar"
import { SafetyBar } from "./ContentGrid"
import { PlatformIcons } from "./PlatformIcons"
import { cn, mediaTypeLabels } from "@/lib/utils"
import type { MediaItem as MockMediaItem } from "@/lib/types"
import { toMediaRouteId } from "@/lib/media-route"
import { useSettings } from "@/contexts/SettingsContext"
import { shouldBlurMedia, BLUR_TOOLTIP } from "@/lib/should-blur-media"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { ageBadgeLabel } from "@/lib/age-label"

const typeIcons = {
  MOVIE: Film,
  TV: Tv,
  GAME: Gamepad2,
  BOOK: BookOpen,
  APP: Smartphone,
  MANGA: Library,
}

interface FamilyFitMember {
  id: string
  name: string
  emoji: string
  score: number
}

interface MediaCardProps {
  media: MockMediaItem
  className?: string
  variant?: "default" | "compact"
  familyFit?: { members: FamilyFitMember[]; familyWarning?: boolean; communityFlagged?: boolean } | null
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
    label = "Adapté"
  } else if (effectiveScore <= 3) {
    color = "bg-amber-100 text-amber-700"
    label = "Modéré"
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
      <span className="text-[10px] text-gray-500">({count})</span>
    </div>
  )
}

// Tone tag color mapping
const TONE_COLORS: Record<string, string> = {
  "Doux et chaleureux": "bg-amber-50 text-amber-700",
  "Doux et rassurant": "bg-amber-50 text-amber-700",
  "Joyeux et coloré": "bg-yellow-100 text-yellow-700",
  "Drôle et léger": "bg-yellow-100 text-yellow-700",
  "Aventureux et exaltant": "bg-sky-100 text-sky-700",
  "Épique et grandiose": "bg-indigo-100 text-indigo-700",
  "Mystérieux et intrigant": "bg-purple-100 text-purple-700",
  "Sombre et tendu": "bg-gray-200 text-gray-700",
  "Nostalgique et poétique": "bg-rose-50 text-rose-600",
  "Action intense": "bg-red-100 text-red-700",
  "Effrayant et angoissant": "bg-red-100 text-red-700",
  "Romantique et tendre": "bg-pink-100 text-pink-700",
  "Fait réfléchir": "bg-teal-100 text-teal-700",
  "Inspiré et motivant": "bg-emerald-100 text-emerald-700",
  "Mélancolique et touchant": "bg-violet-100 text-violet-700",
}

// Get content tags — prefer tone tags from enrichment v2 when available
function getContentTags(metrics: MockMediaItem["contentMetrics"], toneTags?: string[]): { label: string; color: string }[] {
  // If we have tone data from enrichment v2, use it
  if (toneTags && toneTags.length > 0) {
    return toneTags.slice(0, 2).map((tag) => ({
      label: tag,
      color: TONE_COLORS[tag] || "bg-violet-100 text-violet-700",
    }))
  }

  // Fallback: content metric-based tags
  if (!metrics) return []

  const tags: { label: string; color: string }[] = []

  // High violence
  if (metrics.violence >= 4) {
    tags.push({ label: "Violence", color: "bg-red-100 text-red-700" })
  }
  // Truly educational content (5 = central theme, not just "has some positive messages")
  if (metrics.positiveMessages >= 5) {
    tags.push({ label: "Éducatif", color: "bg-emerald-100 text-emerald-700" })
  }
  // Exceptional role models
  if (metrics.roleModels >= 5) {
    tags.push({ label: "Modèles+", color: "bg-blue-100 text-blue-700" })
  }
  // Language issues
  if (metrics.language >= 4) {
    tags.push({ label: "Langage", color: "bg-orange-100 text-orange-700" })
  }
  // Sex/Nudity
  if (metrics.sexNudity >= 3) {
    tags.push({ label: "Scènes intimes", color: "bg-pink-100 text-pink-700" })
  }

  return tags.slice(0, 2) // Max 2 tags
}

export function MediaCard({ media, className, variant = "default", familyFit }: MediaCardProps) {
  const Icon = typeIcons[media.type]
  const contentTags = getContentTags(media.contentMetrics, media.toneTags)
  const { settings } = useSettings()
  const [isBlurRemoved, setIsBlurRemoved] = useState(false)

  // Blur 15+ content with at least one mature metric. Source of truth:
  // src/lib/should-blur-media.ts (also used by BlurredPoster).
  const shouldBlur = shouldBlurMedia(
    {
      type: media.type,
      expertAgeRec: media.expertAgeRec,
      violence: media.contentMetrics?.violence,
      sexNudity: media.contentMetrics?.sexNudity,
      language: media.contentMetrics?.language,
      substanceUse: media.contentMetrics?.substanceUse,
      genres: media.genres,
    },
    settings.blur18Plus,
  )
  const effectiveBlur = shouldBlur && !isBlurRemoved

  // Compact variant - just poster and minimal info (for grids with many items)
  if (variant === "compact") {
    return (
      <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
        <div className={cn("group overflow-hidden transition-all duration-300 h-full flex flex-col", className)}>
          <div className="relative aspect-[2/3] overflow-hidden bg-violet-100 rounded-2xl shadow-md group-hover:shadow-xl group-hover:-translate-y-2 transition-all duration-300">
            <SafeImage
              fallbackClassName="absolute inset-0"
              src={tmdbPosterAtSize(media.posterUrl, "w342")}
              alt={media.title}
              fill
              className={cn(
                "object-cover group-hover:scale-110 transition-transform duration-500",
                effectiveBlur && "blur-sm brightness-90"
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
                title={BLUR_TOOLTIP}
              >
                <div className="bg-black/60 rounded-full p-2">
                  <EyeOff className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-violet-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {typeof media.expertAgeRec === "number" && media.expertAgeRec >= 0 && (
              <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                <AgeBadge age={media.expertAgeRec} size="xs" />
                {media.isProvisional && <ProvisionalBadge size="xs" />}
              </div>
            )}
            <PosterActionBar mediaId={media.id} />
          </div>
          <div className="pt-2 px-1 flex-1">
            <h3 className="font-semibold text-xs text-gray-800 line-clamp-2 group-hover:text-violet-700 transition-colors leading-tight">
              {media.title}
            </h3>
            {/* Platform icons for games */}
            {media.type === "GAME" && media.platforms.length > 0 && (
              <PlatformIcons platforms={media.platforms} variant="compact" maxDisplay={3} className="mt-1" />
            )}
            {/* Family fit pills or warning — reserve a fixed-height slot
                so the compact card row stays vertically aligned. */}
            <div className="mt-1 min-h-[3.5rem]">
              {familyFit?.familyWarning ? (
                <div
                  className="flex items-center gap-1 text-[9px] text-orange-600"
                  title={familyFit.communityFlagged ? "Signalé par les parents" : undefined}
                >
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                  <span className="font-medium">Attention{familyFit.communityFlagged ? "*" : ""}</span>
                </div>
              ) : familyFit && familyFit.members.length > 0 ? (
                <FamilyFitAvatars members={familyFit.members} compact />
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <div
        className={cn(
          "group overflow-hidden transition-all duration-300 h-full flex flex-col",
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
              effectiveBlur && "blur-sm brightness-90"
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
              title={BLUR_TOOLTIP}
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
          <PosterActionBar mediaId={media.id} />
        </div>

        {/* Info Section Below Image - Fixed height for grid alignment */}
        <div className="bg-white rounded-2xl rounded-tr-sm border border-violet-100 -mt-3 relative z-10 p-3 shadow-sm group-hover:shadow-md group-hover:border-violet-200 transition-all duration-300 flex-1 flex flex-col min-h-[7.5rem]">
          {/* Title + Year */}
          <div className="flex items-baseline gap-1.5">
            <h3 className="font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-violet-700 transition-colors leading-tight flex-1 min-w-0">
              {media.title}
            </h3>
            {media.releaseDate && (
              <span className="text-[10px] text-gray-500 shrink-0">{new Date(media.releaseDate).getFullYear()}</span>
            )}
          </div>

          {/* Ratings Row: Age + Family Gauge + Community Rating */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {/* Age Badge - Only show when expert has rated */}
            {typeof media.expertAgeRec === "number" && media.expertAgeRec >= 0 && (
              <div className={cn(
                "inline-flex items-center justify-center px-2 py-1 rounded-full text-[11px] font-bold text-white shadow-sm",
                media.expertAgeRec <= 3
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                  : media.expertAgeRec <= 7
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                  : media.expertAgeRec <= 10
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                  : media.expertAgeRec <= 13
                  ? "bg-gradient-to-r from-orange-500 to-amber-400"
                  : "bg-gradient-to-r from-rose-500 to-red-400"
              )}>
                {ageBadgeLabel(media.expertAgeRec)}
              </div>
            )}

            {media.isProvisional && <ProvisionalBadge size="xs" />}

            {/* Family-friendliness gauge */}
            <FamilyGauge metrics={media.contentMetrics} ageRec={media.expertAgeRec} />

            {/* Community score: only show when real users have reviewed */}
            {media.reviewCount && media.reviewCount > 0 && media.reviewAvgRating ? (
              <CommunityRating avgRating={media.reviewAvgRating} count={media.reviewCount} />
            ) : null}
          </div>

          {/* Content Tags - More colorful pills */}
          <div className="flex flex-wrap gap-1 mt-2 min-h-[1.25rem]">
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

          {/* Family fit pills or warning — pinned to bottom. Reserve enough
              height for an avatar + name + 3-heart gauge stack so the row
              stays aligned even when a card has no per-member fits. */}
          <div className="mt-auto pt-1 min-h-[3.75rem]">
            {familyFit?.familyWarning ? (
              <div
                className="flex items-center gap-1 text-[10px] text-orange-600"
                title={familyFit.communityFlagged ? "Signalé par les parents" : undefined}
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">Attention famille{familyFit.communityFlagged ? "*" : ""}</span>
              </div>
            ) : familyFit && familyFit.members.length > 0 ? (
              <FamilyFitAvatars members={familyFit.members} />
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

// Horizontal variant for lists
export function MediaCardHorizontal({ media, className }: MediaCardProps) {
  const Icon = typeIcons[media.type]
  const contentTags = getContentTags(media.contentMetrics, media.toneTags)
  const { settings } = useSettings()
  const [isBlurRemoved, setIsBlurRemoved] = useState(false)
  // Blur 15+ content with at least one mature metric. Source of truth:
  // src/lib/should-blur-media.ts (also used by BlurredPoster).
  const shouldBlur = shouldBlurMedia(
    {
      type: media.type,
      expertAgeRec: media.expertAgeRec,
      violence: media.contentMetrics?.violence,
      sexNudity: media.contentMetrics?.sexNudity,
      language: media.contentMetrics?.language,
      substanceUse: media.contentMetrics?.substanceUse,
      genres: media.genres,
    },
    settings.blur18Plus,
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
            className={cn("object-cover", effectiveBlur && "blur-sm brightness-90")}
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
              title={BLUR_TOOLTIP}
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


