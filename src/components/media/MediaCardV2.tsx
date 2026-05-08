"use client"

import { useState } from "react"
import Link from "next/link"
import { EyeOff } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "./AgeBadge"
import { cn } from "@/lib/utils"
import { toMediaRouteId } from "@/lib/media-route"
import { useSettings } from "@/contexts/SettingsContext"
import { familyFitBandFromScore, familyFitLabelFromScore, type FamilyFitBand } from "@/lib/family-fit-display"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentMetricsV2 {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
  whatParentsNeedToKnow: string[]
  // V2 enrichment fields
  toneTags?: string[]
  pacing?: string | null
  enrichmentSource?: string
  enrichmentConfidence?: number | null
}

interface MediaItemV2 {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  releaseDate: string | null
  posterUrl: string
  expertAgeRec: number | null
  genres: string[]
  contentMetrics?: ContentMetricsV2 | null
}

interface FamilyFitInfo {
  memberId: string
  memberName: string
  score: number
  emoji: string
}

export interface MediaCardV2Props {
  media: MediaItemV2
  familyFit?: FamilyFitInfo | null
  className?: string
  variant?: "default" | "compact"
  showAiLabel?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fitColor(score: number): string {
  const bandColors: Record<FamilyFitBand, string> = {
    veryAdapted: "bg-emerald-500",
    goodChoice: "bg-sky-500",
    check: "bg-amber-500",
  }

  return bandColors[familyFitBandFromScore(score)]
}

function fitDot(score: number): string {
  const bandDots: Record<FamilyFitBand, string> = {
    veryAdapted: "bg-emerald-200",
    goodChoice: "bg-sky-200",
    check: "bg-amber-200",
  }

  return bandDots[familyFitBandFromScore(score)]
}

// Map tone tags to concise display labels with emoji
const TONE_DISPLAY: Record<string, { emoji: string; short: string }> = {
  "Doux et chaleureux": { emoji: "🌸", short: "Doux" },
  "Doux et rassurant": { emoji: "🌿", short: "Rassurant" },
  "Joyeux et coloré": { emoji: "🌈", short: "Joyeux" },
  "Drôle et léger": { emoji: "😄", short: "Drôle" },
  "Aventureux et exaltant": { emoji: "🗺️", short: "Aventure" },
  "Épique et grandiose": { emoji: "⚔️", short: "Épique" },
  "Mystérieux et intrigant": { emoji: "🔍", short: "Mystère" },
  "Sombre et tendu": { emoji: "🌑", short: "Sombre" },
  "Nostalgique et poétique": { emoji: "🍂", short: "Poétique" },
  "Action intense": { emoji: "💥", short: "Action" },
  "Effrayant et angoissant": { emoji: "👻", short: "Effrayant" },
  "Romantique et tendre": { emoji: "💕", short: "Romantique" },
  "Fait réfléchir": { emoji: "💭", short: "Réflexion" },
  "Inspiré et motivant": { emoji: "✨", short: "Inspirant" },
  "Mélancolique et touchant": { emoji: "🥀", short: "Touchant" },
}

const PACING_DISPLAY: Record<string, { emoji: string; short: string }> = {
  "Très calme": { emoji: "🐢", short: "Très calme" },
  "Lent et contemplatif": { emoji: "🌊", short: "Contemplatif" },
  "Rythme modéré": { emoji: "🎵", short: "Modéré" },
  "Dynamique": { emoji: "🏃", short: "Dynamique" },
  "Rapide et frénétique": { emoji: "⚡", short: "Frénétique" },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaCardV2({
  media,
  familyFit,
  className,
  variant = "default",
  showAiLabel = true,
}: MediaCardV2Props) {
  const { settings } = useSettings()
  const [isBlurRemoved, setIsBlurRemoved] = useState(false)

  const shouldBlur =
    settings.blur18Plus &&
    media.type !== "GAME" &&
    media.expertAgeRec !== null &&
    media.expertAgeRec >= 16 &&
    media.contentMetrics?.violence !== undefined &&
    media.contentMetrics.violence >= 5
  const effectiveBlur = shouldBlur && !isBlurRemoved

  const metrics = media.contentMetrics
  const toneTags = metrics?.toneTags ?? []
  const pacing = metrics?.pacing ?? null
  const enrichmentSource = metrics?.enrichmentSource
  const isAiEnriched = enrichmentSource === "AI_BASIC" || enrichmentSource === "AI_DEEP"

  // Build tone/pacing pills (max 2)
  const pills: { emoji: string; label: string }[] = []
  if (toneTags.length > 0) {
    const first = TONE_DISPLAY[toneTags[0]]
    if (first) pills.push({ emoji: first.emoji, label: first.short })
  }
  if (pacing) {
    const p = PACING_DISPLAY[pacing]
    if (p) pills.push({ emoji: p.emoji, label: p.short })
  }
  // If no pacing but has a second tone, show it
  if (!pacing && toneTags.length > 1 && pills.length < 2) {
    const second = TONE_DISPLAY[toneTags[1]]
    if (second) pills.push({ emoji: second.emoji, label: second.short })
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
        <div className={cn("group overflow-hidden transition-all duration-300 h-full flex flex-col", className)}>
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
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBlurRemoved(true) }}
                role="button"
                aria-label="Afficher le contenu"
              >
                <div className="bg-black/60 rounded-full p-2">
                  <EyeOff className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-violet-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {media.expertAgeRec != null && media.expertAgeRec > 0 && (
              <div className="absolute top-2 left-2">
                <AgeBadge age={media.expertAgeRec} size="xs" />
              </div>
            )}
            {/* Family Fit pill on poster */}
            {familyFit && (
              <div className="absolute bottom-2 left-2 z-10">
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold shadow-lg backdrop-blur-sm",
                  fitColor(familyFit.score),
                  "bg-opacity-90"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", fitDot(familyFit.score))} />
                  {familyFitLabelFromScore(familyFit.score)} {familyFit.emoji}
                </div>
              </div>
            )}
          </div>
          <div className="pt-2 px-1 flex-1">
            <h3 className="font-semibold text-xs text-gray-800 line-clamp-2 group-hover:text-violet-700 transition-colors leading-tight">
              {media.title}
            </h3>
          </div>
        </div>
      </Link>
    )
  }

  // Default variant
  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`}>
      <div
        className={cn(
          "group overflow-hidden transition-all duration-300 h-full flex flex-col",
          className
        )}
      >
        {/* Poster */}
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
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBlurRemoved(true) }}
              role="button"
              aria-label="Afficher le contenu"
            >
              <div className="bg-black/60 rounded-full p-2">
                <EyeOff className="h-5 w-5 text-white" />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-violet-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Age badge - top left */}
          {media.expertAgeRec != null && media.expertAgeRec > 0 && (
            <div className="absolute top-2 left-2">
              <AgeBadge age={media.expertAgeRec} size="sm" />
            </div>
          )}

          {/* Family Fit pill - bottom left overlay */}
          {familyFit && (
            <div className="absolute bottom-2 left-2 z-10">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-bold shadow-lg backdrop-blur-sm",
                fitColor(familyFit.score),
                "bg-opacity-90"
              )}>
                <span className={cn("w-2 h-2 rounded-full animate-pulse", fitDot(familyFit.score))} />
                {familyFitLabelFromScore(familyFit.score)} · {familyFit.memberName}
              </div>
            </div>
          )}
        </div>

        {/* Info below poster */}
        <div className="bg-white rounded-2xl rounded-tr-sm border border-violet-100 -mt-3 relative z-10 p-3 space-y-1.5 shadow-sm group-hover:shadow-md group-hover:border-violet-200 transition-all duration-300 flex-1">
          {/* Title + Year */}
          <div className="flex items-baseline gap-1.5">
            <h3 className="font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-violet-700 transition-colors leading-tight flex-1 min-w-0">
              {media.title}
            </h3>
            {media.releaseDate && (
              <span className="text-[10px] text-gray-500 shrink-0">
                {new Date(media.releaseDate).getFullYear()}
              </span>
            )}
          </div>

          {/* Tone pills */}
          {pills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pills.map((pill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700 border border-violet-100"
                >
                  <span>{pill.emoji}</span>
                  {pill.label}
                </span>
              ))}
            </div>
          )}

          {/* Fallback to content tags when no tone data */}
          {pills.length === 0 && metrics && (
            <div className="flex flex-wrap gap-1">
              {metrics.positiveMessages >= 5 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                  Éducatif
                </span>
              )}
              {metrics.roleModels >= 5 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                  Modèles+
                </span>
              )}
            </div>
          )}

          {/* AI transparency label */}
          {showAiLabel && isAiEnriched && (
            <p className="text-[9px] text-gray-500 leading-tight">
              Estimation IA
              {enrichmentSource === "AI_DEEP" && " (approfondie)"}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
