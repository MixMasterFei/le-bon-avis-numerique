"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface GameItem {
  id: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics?: {
    violence?: number | null
    sexNudity?: number | null
    language?: number | null
    substanceUse?: number | null
  } | null
}

/**
 * "Sortis récemment en jeux vidéo" — homepage rail mirroring
 * NouveautesMangaRail. Pulls the most recent GAME catalog rows by
 * release date so families see what's just landed on consoles. Hides
 * itself when fewer than 3 items would render so the homepage doesn't
 * look broken between IGDB syncs.
 *
 * Sources via /api/db/games?sortBy=releaseDate which already enforces
 * isEnriched + expertAgeRec NOT NULL + console-only platform filter
 * by default — so the rail surfaces only family-graded console games,
 * not random PC indie shovelware.
 */
export function NouveautesGamesRail({ serifClass }: { serifClass: string }) {
  const [items, setItems] = useState<GameItem[]>([])
  const [loading, setLoading] = useState(true)
  const p = APERCU_PALETTE

  useEffect(() => {
    // Pull a few extra in case the dedup/render rules drop some — we
    // only display 7 (one rail row at sm:grid-cols-7).
    fetch("/api/db/games?sortBy=releaseDate&limit=10&requirePoster=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.games)) setItems(data.games)
        else setItems([])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  // Self-hiding: same threshold as the manga rail.
  if (!loading && items.length < 3) return null

  const cardItems: ApercuCardMedia[] = items.map((g) => ({
    id: g.id,
    type: "GAME" as const,
    title: g.title,
    posterUrl: g.posterUrl,
    expertAgeRec: g.expertAgeRec,
    genres: g.genres,
    contentMetrics: g.contentMetrics ?? null,
  }))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Sur les consoles cette semaine
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Sortis récemment en{" "}
            <em className="italic" style={{ color: p.accent }}>
              jeux vidéo
            </em>
          </h2>
        </div>
        <Link
          href="/jeux?sort=releaseDate"
          className="text-sm hover:opacity-70"
          style={{ color: p.ink }}
        >
          Voir tout →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl animate-pulse"
              style={{ background: p.placeholder }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {cardItems.slice(0, 7).map((g) => (
            <ApercuMediaCard key={g.id} media={g} size="sm" serifClass={serifClass} />
          ))}
        </div>
      )}
    </div>
  )
}
