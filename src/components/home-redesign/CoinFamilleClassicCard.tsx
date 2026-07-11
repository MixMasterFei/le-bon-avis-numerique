"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { RedesignCardMedia } from "./RedesignCard"

const TYPE_LABELS: Record<RedesignCardMedia["type"], string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
}

/**
 * "Les classiques à redécouvrir" tile — compact poster + a single-line title,
 * sized to sit in a horizontally-scrollable row (flex + overflow-x-auto) so
 * the whole section stays on one line regardless of how many titles or how
 * narrow the viewport is. The fit reason is a hover tooltip rather than
 * inline text, keeping each tile to one line.
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
  const ageLabel =
    typeof media.expertAgeRec === "number" && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : null

  return (
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      title={reason ?? media.title}
      className="group w-[104px] shrink-0"
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg transition-transform duration-200 group-hover:-translate-y-0.5"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        {media.posterUrl && (
          <SafeImage
            src={tmdbPosterAtSize(media.posterUrl, "w185")}
            alt={media.title}
            fill
            className="object-cover"
            sizes="104px"
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 34%)" }}
        />
        <span className="absolute left-1.5 top-1.5 z-10 text-[9px] font-bold uppercase tracking-[0.1em] text-white/85">
          {TYPE_LABELS[media.type]}
        </span>
        {ageLabel && (
          <span
            className="absolute right-1.5 top-1.5 z-10 rounded px-1 py-0.5 text-[10px] font-extrabold leading-none text-white"
            style={{ background: "rgba(15,12,8,.6)", border: "1px solid rgba(255,255,255,.22)" }}
          >
            {ageLabel}
          </span>
        )}
      </div>
      <div
        className={`${serifClass} mt-1.5 line-clamp-1 text-[12.5px] font-medium leading-tight`}
        style={{ color: p.ink }}
      >
        {media.title}
      </div>
    </Link>
  )
}
