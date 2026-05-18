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
import { APERCU_PALETTE, ageBadgeColor, genreBadgeColor } from "./apercuTheme"

export interface ApercuCardMedia {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  cornerLabel?: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  contentMetrics?: {
    violence?: number | null
    sexNudity?: number | null
    language?: number | null
    substanceUse?: number | null
  } | null
}

export function ApercuMediaCard({
  media,
  size = "md",
  serifClass,
}: {
  media: ApercuCardMedia
  size?: "sm" | "md"
  serifClass: string
}) {
  const { getFamilyFit, registerMediaId } = useFamilyFit()
  const { settings } = useSettings()
  const [revealed, setRevealed] = useState(false)
  const p = APERCU_PALETTE

  useEffect(() => {
    registerMediaId(media.id)
  }, [media.id, registerMediaId])

  const familyFit = getFamilyFit(media.id)

  const ageLabel =
    typeof media.expertAgeRec === "number" ? `${media.expertAgeRec}+` : null
  const ageColors = ageBadgeColor(media.expertAgeRec)

  const titleClass =
    size === "sm" ? "text-[12px] leading-tight" : "text-[13px] leading-snug"

  // Cap at 2 visible genres on small cards so the row stays single-line
  // even with longer labels like "Action & Adventure". The 3rd tag was
  // wrapping off-screen due to max-h clipping.
  const visibleGenres = (media.genres ?? []).slice(0, size === "sm" ? 2 : 3)

  // Same blur rule used everywhere else on the site (15+ AND any
  // content metric >= 3). Eye-overlay reveals on click; tooltip
  // points users to the parameters toggle.
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
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      className="group block"
    >
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        {media.posterUrl && (
          <SafeImage
            // Rewrite to w342 — the rail card displays at ~170-205 CSS px,
            // so w500 was over-fetching ~50% of the bytes per poster.
            src={tmdbPosterAtSize(media.posterUrl, "w342")}
            alt={media.title}
            fill
            className={cn(
              "object-cover transition-all duration-300",
              shouldBlur && "blur-sm brightness-90",
            )}
            sizes="(max-width: 768px) 45vw, 20vw"
          />
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
            className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          >
            <div className="bg-black/55 rounded-full p-2">
              <EyeOff className="h-4 w-4 text-white" />
            </div>
          </button>
        )}
        {ageLabel && (
          <div
            className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight z-20"
            style={{
              background: ageColors.bg,
              color: ageColors.text,
              boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            }}
          >
            {ageLabel}
          </div>
        )}
        {media.cornerLabel && (
          <div
            className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight z-20"
            style={{
              background: "rgba(248, 244, 235, 0.92)",
              color: p.ink,
              boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            }}
          >
            {media.cornerLabel}
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <div
          className={`${serifClass} ${titleClass} line-clamp-2 font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {media.title}
        </div>
        {visibleGenres.length > 0 && (
          <div className="mt-1 flex flex-nowrap gap-0.5 overflow-hidden max-h-[18px]">
            {visibleGenres.map((g) => {
              const c = genreBadgeColor(g)
              return (
                <span
                  key={g}
                  className="px-1 py-0.5 rounded text-[9px] font-semibold leading-tight whitespace-nowrap truncate"
                  style={{ background: c.bg, color: c.text }}
                >
                  {g}
                </span>
              )
            })}
          </div>
        )}
      </div>
      {/* Reserve a fixed-height slot so cards stay horizontally aligned in
          the grid regardless of whether the per-member pills render. The
          slot accommodates a single avatar + name + 3-heart gauge stack. */}
      <div className="mt-1.5 min-h-[3.5rem]">
        {familyFit && familyFit.members.length > 0 && (
          <FamilyFitAvatars members={familyFit.members} compact />
        )}
        {/* Admin-only debug overlay. The server only attaches `_debug` for
            ADMIN users (defense in depth — non-admins never see this even
            if a stale client tries to render it). Tells us at a glance why
            a card shows 0 or fewer avatars than expected. */}
        {familyFit?._debug && familyFit._debug.excluded.length > 0 && (
          <details
            className="mt-1 text-[10px] leading-tight"
            onClick={(e) => e.stopPropagation()}
          >
            <summary
              className="cursor-pointer text-amber-700/80 hover:text-amber-800 select-none"
              onClick={(e) => {
                e.preventDefault()
                const el = e.currentTarget.parentElement as HTMLDetailsElement | null
                if (el) el.open = !el.open
              }}
            >
              {familyFit._debug.excluded.length} exclu
              {familyFit._debug.excluded.length > 1 ? "s" : ""} (admin)
            </summary>
            <ul className="mt-0.5 space-y-0.5 text-amber-900/90">
              {familyFit._debug.excluded.map((x) => (
                <li key={x.id}>
                  <span className="font-medium">{x.name}</span> · {x.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Link>
  )
}

export function ApercuSectionHeading({
  eyebrow,
  title,
  titleAccent,
  titleTail,
  action,
  serifClass,
}: {
  eyebrow?: string
  title: string
  titleAccent?: string
  titleTail?: string
  action?: { label: string; href: string }
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && (
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
          style={{ letterSpacing: "-0.02em", color: p.ink }}
        >
          {title}
          {titleAccent && (
            <em className="italic" style={{ color: p.accent }}>
              {" "}
              {titleAccent}
            </em>
          )}
          {titleTail && <>{titleTail}</>}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70"
          style={{ color: p.ink }}
        >
          {action.label} <span>→</span>
        </Link>
      )}
    </div>
  )
}
