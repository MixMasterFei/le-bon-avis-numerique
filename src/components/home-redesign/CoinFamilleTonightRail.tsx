"use client"

import { useEffect, useState } from "react"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"
import { homepageRailLabel, type HomepageState } from "@/lib/homepage-time-context"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface RawItem {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
}

function toCardType(t: unknown): RedesignCardMedia["type"] {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : "MOVIE"
}

/**
 * "Ce soir" — time-aware, multi-type family consensus (films + séries + jeux),
 * ranked by the whole family's fit via /api/coin-famille/tonight. Per-member
 * avatars come from the page's FamilyFitProvider. Self-hides under 3 results.
 */
export function CoinFamilleTonightRail({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [state, setState] = useState<HomepageState>("default")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/coin-famille/tonight")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        setState((data?.state as HomepageState) ?? "default")
        const arr: RawItem[] = Array.isArray(data?.items) ? data.items : []
        setItems(
          arr.map((m) => ({
            id: m.id,
            type: toCardType(m.type),
            title: m.title,
            posterUrl: m.posterUrl,
            expertAgeRec: m.expertAgeRec ?? null,
            genres: m.genres ?? [],
            contentMetrics: null,
            cornerLabel: null,
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

  if (!loading && items.length < 3) return null
  const label = homepageRailLabel(state)

  return (
    <section className="mt-2">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: p.accent }}>
          {label.eyebrow} · en famille
        </div>
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium leading-[1.05] m-0`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {label.prefix}
          <em className="italic" style={{ color: p.accent }}>
            {label.emphasis}
          </em>
          {label.suffix}
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading && items.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: p.placeholder }} />
            ))
          : items.slice(0, 8).map((m) => (
              <RedesignCard key={m.id} media={m} totem="full" showType familyVariant="avatars" />
            ))}
      </div>
    </section>
  )
}
