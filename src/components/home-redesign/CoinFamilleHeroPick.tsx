"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { FamilyFitMeter } from "./FamilyFitMeter"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { genreLabelFr, genreBadgeColor } from "@/components/home-v2/apercuTheme"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { RedesignCardMedia } from "./RedesignCard"

const TYPE_LABELS: Record<RedesignCardMedia["type"], string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
}

/**
 * Spotlight card for the #1 pick in the active tab — gives the page a clear
 * "start here" anchor without adding another network request.
 */
export function CoinFamilleHeroPick({
  media,
  serifClass,
  badge,
}: {
  media: RedesignCardMedia
  serifClass: string
  badge: string
}) {
  const p = APERCU_PALETTE
  const { getFamilyFit, registerMediaId } = useFamilyFit()
  const familyFit = getFamilyFit(media.id)

  useEffect(() => {
    registerMediaId(media.id)
  }, [media.id, registerMediaId])

  return (
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      className="group mb-5 block overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div className="grid grid-cols-[112px_1fr] gap-0 sm:grid-cols-[148px_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden sm:aspect-auto sm:min-h-[220px]">
          {media.posterUrl && (
            <SafeImage
              src={tmdbPosterAtSize(media.posterUrl, "w342")}
              alt={media.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="148px"
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 hidden sm:block"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,.08))" }}
          />
        </div>

        <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: p.accent }}>
            {badge}
          </div>
          <h3
            className={`${serifClass} mt-1 text-xl font-medium leading-tight line-clamp-2 sm:text-2xl`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {media.title}
          </h3>
          {media.cornerLabel && (
            <p className="mt-2 text-sm leading-snug" style={{ color: p.ink2 }}>
              {media.cornerLabel}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: p.card, color: p.ink2, border: `1px solid ${p.line}` }}
            >
              {TYPE_LABELS[media.type]}
            </span>
            {(media.genres ?? []).slice(0, 2).map((genre) => {
              const colors = genreBadgeColor(genre)
              return (
                <span
                  key={genre}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {genreLabelFr(genre)}
                </span>
              )
            })}
          </div>
          {familyFit && familyFit.members.length > 0 && (
            <div className="mt-3">
              {/* V2 per-member meter (monogram + segments) — the heart gauge is
                  the pre-V2 display and looked a generation behind here. */}
              <FamilyFitMeter members={familyFit.members} />
            </div>
          )}
          <span
            className="mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold transition-opacity group-hover:opacity-70"
            style={{ color: p.ink }}
          >
            Voir la fiche
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
