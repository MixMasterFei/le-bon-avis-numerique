"use client"

import { useEffect, useState } from "react"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"
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
 * A single-row personalized "category" for Le Coin Famille. Fetches
 * /api/coin-famille/tonight (optionally scoped to a member subset via
 * ?members=) and renders one row of V2 cards with the per-member meter.
 * Used both for "À regarder tous ensemble" (whole family) and each
 * "Pour <name>" rail. Self-hides when the family fit is thin.
 */
export function CoinFamillePicksRail({
  serifClass,
  eyebrow,
  title,
  memberIds = [],
  minItems = 3,
}: {
  serifClass: string
  eyebrow: string
  title: string
  memberIds?: string[]
  minItems?: number
}) {
  const p = APERCU_PALETTE
  const key = memberIds.join(",")
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On a member-selection change we keep the current cards visible until the
    // new set resolves (no loading flash); skeletons only show on first load.
    let cancelled = false
    const qs = key ? `?members=${encodeURIComponent(key)}` : ""
    fetch(`/api/coin-famille/tonight${qs}`)
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
  }, [key])

  if (!loading && items.length < minItems) return null

  return (
    <section>
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: p.accent }}>
          {eyebrow}
        </div>
        <h2
          className={`${serifClass} text-xl md:text-2xl font-medium leading-[1.05] m-0`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {loading && items.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: p.placeholder }} />
            ))
          : items.slice(0, 5).map((m) => <RedesignCard key={m.id} media={m} totem="compact" showType />)}
      </div>
    </section>
  )
}
