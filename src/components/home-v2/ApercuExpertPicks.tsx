"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface Pick extends ApercuCardMedia {
  dataQualityScore?: number
}

export function ApercuExpertPicks({ serifClass }: { serifClass: string }) {
  const [items, setItems] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const p = APERCU_PALETTE

  const fetchPicks = useCallback(async (seed?: number) => {
    try {
      const params = new URLSearchParams({ limit: "6" })
      if (seed !== undefined) params.set("seed", String(seed))
      const res = await fetch(`/api/db/expert-picks?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data?.items)) setItems(data.items)
      }
    } catch (error) {
      console.error("Failed to fetch expert picks:", error)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPicks().finally(() => setLoading(false))
  }, [fetchPicks])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPicks(Math.floor(Math.random() * 1000000))
    setRefreshing(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Coups de cœur
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Nos{" "}
            <em className="italic" style={{ color: p.accent }}>
              coups de cœur
            </em>
          </h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-50 transition-opacity"
          style={{ color: p.ink }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Autre sélection
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl animate-pulse"
              style={{ background: p.placeholder }}
            />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {items.map((item) => (
            <ApercuMediaCard key={item.id} media={item} size="sm" serifClass={serifClass} />
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: p.ink2 }}>
          Les coups de cœur seront disponibles prochainement.
        </p>
      )}
    </div>
  )
}
