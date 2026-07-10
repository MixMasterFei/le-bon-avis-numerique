"use client"

import { useEffect, useState } from "react"
import { UpcomingCard, type UpcomingItem } from "./UpcomingCard"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { upcomingRailLabel, type HomepageState } from "@/lib/homepage-time-context"

interface RawItem {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  releaseDate?: string | null
  fitLabel?: string | null
}

function toCardType(t: unknown): UpcomingItem["type"] {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : "MOVIE"
}

/**
 * "Bientôt pour vous" — upcoming titles ranked by the family's taste via
 * /api/coin-famille/upcoming. Reuses UpcomingCard (keeps the "Prévenez-moi"
 * release-alert). Self-hides when empty.
 */
export function CoinFamilleUpcomingRail({
  serifClass,
  timeState = "default",
}: {
  serifClass: string
  timeState?: HomepageState
}) {
  const p = APERCU_PALETTE
  const label = upcomingRailLabel(timeState)
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/coin-famille/upcoming")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr: RawItem[] = Array.isArray(data?.items) ? data.items : []
        setItems(
          arr.map((m) => ({
            id: m.id,
            type: toCardType(m.type),
            title: m.title,
            posterUrl: m.posterUrl,
            expertAgeRec: m.expertAgeRec ?? null,
            genres: m.genres ?? [],
            releaseDate: m.releaseDate ?? null,
            fitLabel: m.fitLabel ?? null,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && items.length === 0) return null

  return (
    <section className="mt-2">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: p.accent }}>
          {label.eyebrow}
        </div>
        <h2
          className={`${serifClass} text-xl md:text-2xl font-medium leading-[1.05] m-0`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Les prochaines sorties{" "}
          <em className="italic" style={{ color: p.accent }}>
            {label.titleEmphasis}
          </em>
        </h2>
        <p className="mt-1 text-sm" style={{ color: p.ink2 }}>
          {label.lead}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[232px] animate-pulse rounded-[14px]" style={{ background: p.placeholder }} />
            ))
          : items.slice(0, 9).map((it) => <UpcomingCard key={it.id} item={it} />)}
      </div>
    </section>
  )
}
