"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { genreLabelFr, genreBadgeColor, APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { RedesignCardMedia } from "./RedesignCard"

const TYPE_LABELS: Record<RedesignCardMedia["type"], string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
}

/**
 * "Le classique à redécouvrir" — a single older catalog title that still fits
 * the foyer. Compact horizontal card so it reads as a secondary band under the
 * daily picks, not a second spotlight. `reason` is already phrased upstream.
 */
export function CoinFamilleClassicCard({
  media,
  reason,
  serifClass,
}: {
  media: RedesignCardMedia
  reason?: string
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      className="group flex gap-3 overflow-hidden rounded-2xl p-2.5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div className="relative aspect-[2/3] w-[72px] shrink-0 overflow-hidden rounded-lg" style={{ background: p.placeholder }}>
        {media.posterUrl && (
          <SafeImage
            src={tmdbPosterAtSize(media.posterUrl, "w185")}
            alt={media.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="72px"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-center py-0.5">
        <h4
          className={`${serifClass} text-base font-medium leading-tight line-clamp-2`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {media.title}
        </h4>
        {reason && (
          <p className="mt-1 text-[12.5px] italic leading-snug line-clamp-2" style={{ color: p.ink2 }}>
            {reason}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: p.card, color: p.ink2, border: `1px solid ${p.line}` }}
          >
            {TYPE_LABELS[media.type]}
          </span>
          {(media.genres ?? []).slice(0, 1).map((genre) => {
            const colors = genreBadgeColor(genre)
            return (
              <span
                key={genre}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: colors.bg, color: colors.text }}
              >
                {genreLabelFr(genre)}
              </span>
            )
          })}
          <span
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity group-hover:opacity-70"
            style={{ color: p.ink }}
          >
            Voir la fiche
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}
