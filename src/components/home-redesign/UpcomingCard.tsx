"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Check } from "lucide-react"
import { toMediaRouteId } from "@/lib/media-route"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { genreLabelFr } from "@/components/home-v2/apercuTheme"

export interface UpcomingItem {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  releaseDate: string | null
}

const TYPE_LABELS: Record<UpcomingItem["type"], string> = { MOVIE: "Film", TV: "Série", GAME: "Jeu" }
const WHERE: Record<UpcomingItem["type"], string> = { MOVIE: "Au cinéma", TV: "Streaming", GAME: "Consoles" }

/**
 * Compact "Bientôt" card (design `.up-card`): poster-cropped header with a
 * date chip + type, then title, genres · conseillé X+, a "where" pill and a
 * "Prévenez-moi" notify toggle (localStorage). No content totem — these are
 * unreleased, so we don't score them.
 */
export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const [notified, setNotified] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(`ta-notify-${item.id}`) === "1") {
      queueMicrotask(() => setNotified(true))
    }
  }, [item.id])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setNotified((n) => {
      const next = !n
      try {
        window.localStorage.setItem(`ta-notify-${item.id}`, next ? "1" : "0")
      } catch {}
      return next
    })
  }

  const href = `/media/${toMediaRouteId(item.type, item.id)}`
  const genreStr = item.genres.slice(0, 2).map(genreLabelFr).join(" · ")
  const ageStr = typeof item.expertAgeRec === "number" && item.expertAgeRec > 0 ? `conseillé ${item.expertAgeRec}+` : null
  const meta = [genreStr, ageStr].filter(Boolean).join(" · ")

  let month: string | null = null
  let day: number | null = null
  if (item.releaseDate) {
    const d = new Date(item.releaseDate)
    if (!Number.isNaN(d.getTime())) {
      month = d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")
      day = d.getDate()
    }
  }

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-[14px]"
      style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm, 0 10px 26px -22px rgba(40,28,12,.6))", scrollSnapAlign: "start" }}
    >
      <Link href={href} className="block">
        <div className="relative h-[108px] overflow-hidden" style={{ background: "var(--placeholder, #E6DFCE)" }}>
          {item.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbPosterAtSize(item.posterUrl, "w342")}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "center 22%" }}
              loading="lazy"
            />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0) 62%)" }} />
          {/* date chip */}
          <div
            className="absolute left-[13px] top-3 flex flex-col items-center rounded-[8px] px-[9px] py-[5px] leading-tight text-white backdrop-blur-[3px]"
            style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.25)" }}
          >
            {month && day != null ? (
              <>
                <span className="text-[11px] font-bold uppercase">{month}</span>
                <b className="text-[18px] leading-none" style={{ fontFamily: "var(--font-bricolage)" }}>{day}</b>
              </>
            ) : (
              <span className="text-[12px] font-bold uppercase">Bientôt</span>
            )}
          </div>
          <span className="absolute bottom-2.5 left-[13px] text-[11px] font-bold uppercase tracking-[0.12em] text-white/90">
            {TYPE_LABELS[item.type]}
          </span>
        </div>
      </Link>

      <div className="px-[15px] pb-[15px] pt-[14px]">
        <Link href={href} className="block">
          <div className="text-[17px] font-bold leading-snug" style={{ color: "var(--ink)" }}>{item.title}</div>
        </Link>
        {meta && <div className="mt-[3px] text-[13px]" style={{ color: "var(--ink-3)" }}>{meta}</div>}
        <div className="mt-3 flex items-center justify-between gap-2.5">
          <span className="rounded-full px-[10px] py-1 text-[12px] font-bold" style={{ color: "var(--pine-2)", background: "var(--pine-soft)" }}>
            {WHERE[item.type]}
          </span>
          <button
            onClick={toggle}
            aria-pressed={notified}
            className="inline-flex items-center gap-1.5 rounded-full px-[13px] py-[7px] text-[13px] font-bold transition-colors"
            style={
              notified
                ? { background: "var(--pine)", border: "1.5px solid var(--pine)", color: "#fff" }
                : { background: "transparent", border: "1.5px solid var(--line)", color: "var(--ink-2)" }
            }
          >
            {notified ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {notified ? "Prévenu" : "Prévenez-moi"}
          </button>
        </div>
      </div>
    </div>
  )
}
