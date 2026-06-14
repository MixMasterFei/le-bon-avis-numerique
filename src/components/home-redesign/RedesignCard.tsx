"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { EyeOff } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { FamilyFitAvatars } from "@/components/media/FamilyFitAvatars"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import { useSettings } from "@/contexts/SettingsContext"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { shouldBlurMedia, BLUR_TOOLTIP } from "@/lib/should-blur-media"
import { cn } from "@/lib/utils"
import { genreLabelFr, genreBadgeColor } from "@/components/home-v2/apercuTheme"
import { TotemRating } from "./TotemRating"
import { FamilyFitMeter } from "./FamilyFitMeter"
import { hasTotemData, type TotemMetrics } from "./totem"

export interface RedesignCardMedia {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  contentMetrics?: TotemMetrics | null
  cornerLabel?: string | null
}

const TYPE_LABELS: Record<RedesignCardMedia["type"], string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
}

/**
 * V2 poster card: real artwork + the totem rating (badge + hover popover) +
 * a title/genre foot. Reuses the site's family-fit batching + sensitivity
 * blur. `upcoming` cards show the age badged "à confirmer" and no content
 * totem (honesty — we don't score unseen titles).
 */
export function RedesignCard({
  media,
  totem = "compact",
  upcoming = false,
  showType = false,
  familyVariant = "avatars",
}: {
  media: RedesignCardMedia
  totem?: "compact" | "full"
  upcoming?: boolean
  showType?: boolean
  /** Family-fit row style: "avatars" = heart gauge (homepage rails),
   *  "meter" = vertical-segment meter (catalogue V2 cards). */
  familyVariant?: "avatars" | "meter"
}) {
  const { getFamilyFit, registerMediaId } = useFamilyFit()
  const { settings } = useSettings()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    registerMediaId(media.id)
  }, [media.id, registerMediaId])

  const familyFit = getFamilyFit(media.id)
  const visibleGenres = (media.genres ?? []).slice(0, 2)
  const showTotem = !upcoming && hasTotemData(media.contentMetrics, media.type)
  const ageLabel = typeof media.expertAgeRec === "number" && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : null

  const shouldBlur =
    !revealed &&
    shouldBlurMedia(
      {
        type: media.type,
        expertAgeRec: media.expertAgeRec,
        violence: media.contentMetrics?.violence,
        sexNudity: media.contentMetrics?.sexNudity,
        language: media.contentMetrics?.language,
        substanceUse: media.contentMetrics?.substanceUse,
      },
      settings.blur18Plus,
    )

  return (
    <Link href={`/media/${toMediaRouteId(media.type, media.id)}`} className="group block">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-[14px] transition-transform duration-200 group-hover:-translate-y-1"
        style={{ background: "var(--placeholder, #E6DFCE)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm, 0 10px 26px -22px rgba(40,28,12,.6))" }}
      >
        {media.posterUrl && (
          <SafeImage
            src={tmdbPosterAtSize(media.posterUrl, "w342")}
            alt={media.title}
            fill
            className={cn("object-cover transition-all duration-300", shouldBlur && "blur-sm brightness-90")}
            sizes="(max-width: 768px) 45vw, 220px"
          />
        )}
        {/* top + bottom scrims for badge legibility */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 30%), linear-gradient(to top, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 42%)",
          }}
        />

        {showType && (
          <span className="absolute left-3.5 top-3 z-20 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/85">
            {TYPE_LABELS[media.type]}
          </span>
        )}

        {shouldBlur && (
          <button
            type="button"
            title={BLUR_TOOLTIP}
            aria-label="Afficher le contenu"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setRevealed(true)
            }}
            className="absolute inset-0 z-30 flex items-center justify-center"
          >
            <div className="rounded-full bg-black/55 p-2">
              <EyeOff className="h-4 w-4 text-white" />
            </div>
          </button>
        )}

        {/* Totem badge (or honest "à confirmer" for unreleased) */}
        {showTotem ? (
          <TotemRating age={media.expertAgeRec} metrics={media.contentMetrics} variant={totem} type={media.type} />
        ) : (
          ageLabel && (
            <div
              className="absolute right-3 top-3 z-30 flex flex-col items-center rounded-[9px] px-2 py-1.5 backdrop-blur-[3px]"
              style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.22)" }}
            >
              <span className="text-[14px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
                {ageLabel}
              </span>
              {upcoming && <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/75">à confirmer</span>}
            </div>
          )
        )}

        {/* Hover explainer — only when we have real content data */}
        {showTotem && <TotemRating age={media.expertAgeRec} metrics={media.contentMetrics} variant="popover" type={media.type} />}

        {media.cornerLabel && (
          <span
            className="absolute left-3 top-3 z-20 rounded-md px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(248,244,235,.92)", color: "var(--ink)" }}
          >
            {media.cornerLabel}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <div className="text-[14.5px] font-bold leading-tight line-clamp-1" style={{ color: "var(--ink)" }}>
          {media.title}
        </div>
        {visibleGenres.length > 0 && (
          <div className="mt-1 flex flex-nowrap gap-1 overflow-hidden">
            {visibleGenres.map((g) => {
              const c = genreBadgeColor(g)
              return (
                <span
                  key={g}
                  className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                  style={{ background: c.bg, color: c.text }}
                >
                  {genreLabelFr(g)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Family-fit row (reserved height keeps the grid aligned) */}
      <div className="mt-1.5 min-h-[2rem]">
        {familyFit && familyFit.members.length > 0 &&
          (familyVariant === "meter" ? (
            <FamilyFitMeter members={familyFit.members} />
          ) : (
            <FamilyFitAvatars members={familyFit.members} compact />
          ))}
      </div>
    </Link>
  )
}
