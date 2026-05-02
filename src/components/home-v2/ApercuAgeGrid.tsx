"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { APERCU_AGE_BUCKETS, APERCU_PALETTE, buildAgeBucketHref } from "./apercuTheme"

export function ApercuAgeGrid({ serifClass }: { serifClass: string }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const p = APERCU_PALETTE

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        APERCU_AGE_BUCKETS.map(async (b) => {
          try {
            // Count must mirror the filter set the films page actually
            // applies (films/page.tsx) so the number on the tile matches
            // what the user sees on click. Films page uses requirePoster
            // + language=fr,en + the maxAge/caps; it does NOT apply
            // minQuality. Diverging from that here produces a misleading
            // "X contenus" badge.
            const params = new URLSearchParams({
              maxAge: String(b.maxAge),
              requirePoster: "true",
              language: "fr,en",
              limit: "1",
              page: "1",
            })
            for (const [k, v] of Object.entries(b.caps)) {
              if (typeof v === "number") params.set(k, String(v))
            }
            const res = await fetch(`/api/db/movies?${params}`, { cache: "force-cache" })
            if (!res.ok) return [b.key, null] as const
            const data = await res.json()
            const total =
              typeof data?.pagination?.total === "number"
                ? data.pagination.total
                : typeof data?.total === "number"
                  ? data.total
                  : Array.isArray(data?.movies)
                    ? data.movies.length
                    : null
            return [b.key, total] as const
          } catch {
            return [b.key, null] as const
          }
        })
      )
      if (cancelled) return
      const map: Record<string, number | null> = {}
      for (const [k, v] of entries) map[k] = v
      setCounts(map)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      className="py-10 md:py-14"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-7">
          <div>
            <div
              className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Par âge
            </div>
            <h2
              className={`${serifClass} text-2xl md:text-4xl font-medium m-0`}
              style={{ letterSpacing: "-0.03em", color: p.ink }}
            >
              Adapté à{" "}
              <em className="italic" style={{ color: p.accent }}>
                chaque
              </em>{" "}
              étape
            </h2>
            <p className="mt-2 text-sm md:text-base max-w-lg" style={{ color: p.ink2 }}>
              Pas juste une étiquette d’âge. On regarde le contenu réel,
              pas l’année de naissance.
            </p>
          </div>
          <Link
            href="/films"
            className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70"
            style={{ color: p.ink }}
          >
            Voir toutes les tranches d’âge <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {APERCU_AGE_BUCKETS.map((b) => {
            const n = counts[b.key]
            return (
              <Link
                key={b.key}
                href={buildAgeBucketHref(b)}
                className="group rounded-2xl p-4 md:p-5 text-left relative overflow-hidden transition-all hover:-translate-y-0.5"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line2}`,
                  color: p.ink,
                }}
              >
                <div
                  className="text-[11px] font-medium tracking-wide mb-4 md:mb-5"
                  style={{ color: p.ink2 }}
                >
                  ans
                </div>
                <div
                  className={`${serifClass} text-3xl md:text-4xl font-medium leading-none mb-1.5`}
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {b.label}
                </div>
                <div className="text-[13px] font-semibold">{b.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: p.ink2 }}>
                  {n === null
                    ? "…"
                    : n === undefined
                      ? "Chargement…"
                      : `${n.toLocaleString("fr-FR")} contenus`}
                </div>
                <div
                  className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors group-hover:opacity-100"
                  style={{ background: b.color, color: p.ink }}
                >
                  →
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
