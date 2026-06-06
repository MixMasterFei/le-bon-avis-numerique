"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface Provider {
  id: string
  label: string
  search: string
  filter: string
  dot: string
}

const PROVIDERS: Provider[] = [
  { id: "netflix", label: "Netflix", search: "Netflix", filter: "Netflix", dot: "#E50914" },
  { id: "disney", label: "Disney+", search: "Disney Plus", filter: "Disney+", dot: "#113CCF" },
  { id: "prime", label: "Prime Video", search: "Amazon Prime Video", filter: "Prime Video", dot: "#00A8E1" },
  { id: "canal", label: "Canal+", search: "Canal", filter: "Canal+", dot: "#111111" },
]

export function ApercuStreaming({ serifClass }: { serifClass: string }) {
  const [selected, setSelected] = useState<Provider>(PROVIDERS[0])
  const [movies, setMovies] = useState<ApercuCardMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const p = APERCU_PALETTE

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(
      `/api/db/streaming?provider=${encodeURIComponent(selected.search)}&limit=5&maxAge=10&type=SUBSCRIPTION&shuffle=weekly&language=fr,en`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.movies)) {
          setMovies(
            data.movies.map(
              (m: {
                id: string
                title: string
                type?: string
                posterUrl: string | null
                expertAgeRec?: number | null
                genres?: string[]
                contentMetrics?: {
                  violence?: number | null
                  sexNudity?: number | null
                  language?: number | null
                  substanceUse?: number | null
                } | null
              }) => ({
                id: m.id,
                type: (m.type === "TV" ? "TV" : "MOVIE") as "MOVIE" | "TV",
                title: m.title,
                posterUrl: m.posterUrl,
                expertAgeRec: m.expertAgeRec ?? null,
                genres: m.genres ?? [],
                contentMetrics: m.contentMetrics ?? null,
              })
            )
          )
          setTotal(typeof data.total === "number" ? data.total : data.movies.length)
        } else {
          setMovies([])
          setTotal(0)
        }
      })
      .catch(() => {
        setMovies([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Ce soir
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Sur vos{" "}
            <em className="italic" style={{ color: p.accent }}>
              plateformes
            </em>
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {PROVIDERS.map((pr) => {
          const active = selected.id === pr.id
          return (
            <button
              key={pr.id}
              onClick={() => setSelected(pr)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors"
              style={{
                background: active ? p.ink : p.card,
                color: active ? p.bg : p.ink,
                border: `1px solid ${active ? p.ink : p.line2}`,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: pr.dot }}
              />
              {pr.label}
            </button>
          )
        })}
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
      ) : movies.length > 0 ? (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {movies.map((m) => (
              <ApercuMediaCard key={m.id} media={m} size="sm" serifClass={serifClass} />
            ))}
          </div>
          <div
            className="mt-4 flex items-center justify-between text-sm"
            style={{ color: p.ink2 }}
          >
            <span>
              {total.toLocaleString("fr-FR")} titres disponibles sur{" "}
              {selected.label}
            </span>
            <Link
              href={`/films/recherche?platforms=${encodeURIComponent(selected.filter)}&maxAge=10`}
              className="hover:opacity-70"
              style={{ color: p.ink }}
            >
              Voir tout →
            </Link>
          </div>
        </>
      ) : (
        <div
          className="text-center py-10 rounded-xl"
          style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
        >
          <p className="text-sm">
            Pas encore de données pour {selected.label}. Mise à jour
            quotidienne.
          </p>
        </div>
      )}
    </div>
  )
}
