"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { PosterActionBar } from "@/components/media/PosterActionBar"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const TYPE_LABELS: Record<PickMedia["type"], string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
}

export interface PickMedia {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
}

/**
 * Compact Coin Famille pick card: small poster + an expandable Totem comment
 * (why it fits) + the shared per-member reaction bar (PosterActionBar), so the
 * "à voir / déjà vu / adoré / pas pour nous" triage is identical to the rest of
 * the site. Marking a title "déjà vu" (WATCHED) records the reaction and asks
 * the rail to swap the card for a fresh idea (`onSeen`).
 */
export function CoinFamillePickCard({
  media,
  comment,
  onSeen,
}: {
  media: PickMedia
  comment?: string
  /** Fired after a persisted WATCHED write — carries WHO watched it so the
   *  rail can hide the card for that member only (not their siblings). */
  onSeen: (id: string, memberId: string) => void
}) {
  const p = APERCU_PALETTE
  const [open, setOpen] = useState(false)

  const ageLabel =
    typeof media.expertAgeRec === "number" && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : null

  return (
    <div className="flex flex-col">
      <Link
        href={`/media/${toMediaRouteId(media.type, media.id)}`}
        className="group relative block aspect-[2/3] overflow-hidden rounded-xl"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        {media.posterUrl && (
          <SafeImage
            src={tmdbPosterAtSize(media.posterUrl, "w342")}
            alt={media.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 33vw, 200px"
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 38%)" }}
        />
        <span className="absolute left-2 top-1.5 z-10 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/85">
          {TYPE_LABELS[media.type]}
        </span>
        {ageLabel && (
          <span
            className="absolute right-2 top-2 z-10 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white"
            style={{ background: "rgba(15,12,8,.6)", border: "1px solid rgba(255,255,255,.22)" }}
          >
            {ageLabel}
          </span>
        )}
        {/* Shared per-member reaction bar. "Déjà vu" (WATCHED) swaps the card
            for a fresh pick via onSeen — preserving the old rail mechanic. */}
        <PosterActionBar
          mediaId={media.id}
          onReact={(kind, memberId, active) => {
            if (kind === "WATCHED" && active) onSeen(media.id, memberId)
          }}
        />
      </Link>

      <div
        className="mt-1.5 line-clamp-1 text-[13px] font-bold leading-tight"
        style={{ color: p.ink }}
        title={media.title}
      >
        {media.title}
      </div>

      {comment && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 inline-flex items-center gap-0.5 self-start text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: p.accent }}
        >
          Pourquoi&nbsp;?
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}

      {open && comment && (
        <p className="mt-1.5 text-[12px] italic leading-relaxed" style={{ color: p.ink2 }}>
          {comment}
        </p>
      )}
    </div>
  )
}
