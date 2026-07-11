"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, Bookmark, Eye, ChevronDown, Loader2 } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

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
 * (why it fits) + quick family actions. "Déjà vu" writes a WATCHED reaction for
 * the active member (so it stops being recommended) and asks the rail to swap
 * the card for a fresh one. Favourite + "à voir" reuse the user-level
 * favourite/watchlist endpoints (same as the media page).
 */
export function CoinFamillePickCard({
  media,
  comment,
  memberId,
  onSeen,
}: {
  media: PickMedia
  comment?: string
  /** Active member id for the WATCHED write; null on the "toute la famille" tab. */
  memberId?: string | null
  onSeen: (id: string) => void
}) {
  const p = APERCU_PALETTE
  const [fav, setFav] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busyFav, setBusyFav] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [seenBusy, setSeenBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const ageLabel =
    typeof media.expertAgeRec === "number" && media.expertAgeRec > 0 ? `${media.expertAgeRec}+` : null

  const toggle = async (
    endpoint: string,
    current: boolean,
    setValue: (v: boolean) => void,
    setBusy: (v: boolean) => void,
    read: (data: unknown) => boolean,
  ) => {
    setBusy(true)
    setValue(!current) // optimistic
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: media.id }),
      })
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      setValue(read(data))
    } catch {
      setValue(current) // revert
    } finally {
      setBusy(false)
    }
  }

  const handleSeen = () => {
    if (seenBusy) return
    setSeenBusy(true)
    // Persist a WATCHED reaction only when we know who watched it (a member
    // tab). On "toute la famille" we don't know the viewer, so the swap is
    // session-local — we never silently mark every child as having watched it.
    if (memberId) {
      fetch("/api/user/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyMemberId: memberId, mediaId: media.id, reaction: "WATCHED" }),
      }).catch(() => {})
    }
    onSeen(media.id)
  }

  const iconBtn = (
    label: string,
    active: boolean,
    activeColor: string,
    busy: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-50"
      style={{
        background: active ? activeColor : p.bg2,
        color: active ? "#fff" : p.ink2,
        border: `1px solid ${active ? activeColor : p.line}`,
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    </button>
  )

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
      </Link>

      <div
        className="mt-1.5 line-clamp-1 text-[13px] font-bold leading-tight"
        style={{ color: p.ink }}
        title={media.title}
      >
        {media.title}
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        {iconBtn(
          "Ajouter aux favoris",
          fav,
          p.accent,
          busyFav,
          () => toggle("/api/user/favorite", fav, setFav, setBusyFav, (d) => Boolean((d as { isFavorite?: boolean }).isFavorite)),
          <Heart className="h-3.5 w-3.5" style={{ fill: fav ? "#fff" : "transparent" }} />,
        )}
        {iconBtn(
          "Ajouter à ma liste (à voir)",
          saved,
          SAGE,
          busySave,
          () => toggle("/api/user/watchlist", saved, setSaved, setBusySave, (d) => Boolean((d as { inWatchlist?: boolean }).inWatchlist)),
          <Bookmark className="h-3.5 w-3.5" style={{ fill: saved ? "#fff" : "transparent" }} />,
        )}
        {iconBtn(
          "Je l’ai déjà vu — proposer autre chose",
          false,
          p.ink,
          seenBusy,
          handleSeen,
          <Eye className="h-3.5 w-3.5" />,
        )}
        {comment && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: p.accent }}
          >
            Pourquoi&nbsp;?
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && comment && (
        <p className="mt-1.5 text-[11.5px] italic leading-snug" style={{ color: p.ink2 }}>
          {comment}
        </p>
      )}
    </div>
  )
}
