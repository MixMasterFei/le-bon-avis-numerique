"use client"

import { useEffect, useState } from "react"
import { ApercuMediaCard, ApercuSectionHeading, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface CinemaMovie extends ApercuCardMedia {
  tmdbId?: number
  inDatabase?: boolean
}

export function ApercuNowInCinema({ serifClass }: { serifClass: string }) {
  const [movies, setMovies] = useState<CinemaMovie[]>([])
  const [loading, setLoading] = useState(true)
  const p = APERCU_PALETTE

  useEffect(() => {
    fetch("/api/cinema")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.movies)) {
          setMovies(
            data.movies.slice(0, 7).map(
              (m: {
                id: string
                title: string
                posterUrl: string | null
                expertAgeRec?: number | null
                genres?: string[]
              }) => ({
                id: m.id,
                type: "MOVIE" as const,
                title: m.title,
                posterUrl: m.posterUrl,
                expertAgeRec: m.expertAgeRec ?? null,
                genres: m.genres ?? [],
              })
            )
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && movies.length === 0) return null

  return (
    <div>
      <ApercuSectionHeading
        eyebrow="En ce moment"
        title="Au"
        titleAccent="cinéma"
        titleTail=" en France"
        action={{ label: "Voir tout", href: "/films?sort=cinema" }}
        serifClass={serifClass}
      />
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl animate-pulse"
              style={{ background: p.placeholder }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {movies.map((m) => (
            <ApercuMediaCard key={m.id} media={m} size="sm" serifClass={serifClass} />
          ))}
        </div>
      )}
    </div>
  )
}
