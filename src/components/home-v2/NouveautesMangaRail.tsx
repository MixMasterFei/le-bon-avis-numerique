"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface MangaItem {
  id: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  demographic: string | null
  latestVolumeDate: string | null
}

/**
 * "Nouveautés manga de la semaine" — drives the weekly releases feature
 * Xavier asked for. Renders nothing when there are fewer than 3 recent
 * items, so the homepage doesn't look empty in the weeks between AniList
 * refreshes.
 */
export function NouveautesMangaRail({ serifClass }: { serifClass: string }) {
  const [items, setItems] = useState<MangaItem[]>([])
  const [loading, setLoading] = useState(true)
  const p = APERCU_PALETTE

  useEffect(() => {
    fetch("/api/mangas/nouveautes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) setItems(data.items)
        else setItems([])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  // Hide the rail entirely until we have enough fresh manga to fill it.
  if (!loading && items.length < 3) return null

  const cardItems: ApercuCardMedia[] = items.map((m) => ({
    id: m.id,
    // ApercuMediaCard only knows the MOVIE/TV/GAME union — MANGA renders
    // the same way (poster + age + genres), so we cast. The detail page
    // uses the real MediaType from the DB.
    type: "MOVIE" as const,
    title: m.title,
    posterUrl: m.posterUrl,
    expertAgeRec: m.expertAgeRec,
    genres: m.genres,
    contentMetrics: null,
  }))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Nouveautés cette semaine
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Sortis récemment en{" "}
            <em className="italic" style={{ color: p.accent }}>
              manga
            </em>
          </h2>
        </div>
        <Link
          href="/mangas?sort=newest"
          className="text-sm hover:opacity-70"
          style={{ color: p.ink }}
        >
          Voir tout →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl animate-pulse"
              style={{ background: p.placeholder }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {cardItems.slice(0, 10).map((m) => (
            <ApercuMediaCard key={m.id} media={m} size="sm" serifClass={serifClass} />
          ))}
        </div>
      )}
    </div>
  )
}
