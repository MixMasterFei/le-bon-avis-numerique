"use client"

import { useEffect, useState } from "react"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { DashboardKpiStrip, buildScoreboardCells, type MetricsLike } from "./DashboardKpiStrip"

type Mode = "totem" | "community"

interface CommunityResponse {
  hasData: boolean
  averages: MetricsLike | null
  sampleSize?: number
}

/**
 * Client wrapper around the KPI strip: an actions row (favori / à voir / avis /
 * partager) on the left and a Totem Avisé ↔ Communauté toggle on the right,
 * then the strip below reflecting the selected source. Community averages come
 * from /api/media/[id]/community-metrics (same source as the classic fiche).
 */
export function DashboardScoreboard({
  mediaId,
  mediaTitle,
  expertMetrics,
  topics,
}: {
  mediaId: string
  mediaTitle: string
  expertMetrics: MetricsLike
  topics: string[]
}) {
  const [mode, setMode] = useState<Mode>("totem")
  const [community, setCommunity] = useState<CommunityResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/media/${mediaId}/community-metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setCommunity(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mediaId])

  const communityHasData = !!community?.hasData
  const cells =
    mode === "totem"
      ? buildScoreboardCells(expertMetrics, topics)
      : buildScoreboardCells(communityHasData ? community!.averages : null, topics)

  const seg = (m: Mode, label: string) => {
    const active = mode === m
    return (
      <button
        type="button"
        onClick={() => setMode(m)}
        className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
        style={active ? { background: "#2A251F", color: "#FFFFFF" } : { color: "#8A8072", background: "transparent" }}
      >
        {label}
      </button>
    )
  }

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
        style={{ borderTop: "1px solid #EFE6D6" }}
      >
        <MediaPageClient mediaId={mediaId} mediaTitle={mediaTitle} showActions />
        <div className="inline-flex items-center rounded-lg p-0.5" style={{ background: "#EFE6D6" }}>
          {seg("totem", "Totem Avisé")}
          {seg("community", "Communauté")}
        </div>
      </div>

      <DashboardKpiStrip cells={cells} />

      {mode === "community" && community && !communityHasData && (
        <div
          className="px-5 py-2 text-center text-[11px]"
          style={{ background: "#FBF8F2", color: "#8A8072", borderTop: "1px solid #EFE6D6" }}
        >
          Pas encore d&apos;avis communautaire — soyez les premiers à noter ce titre.
        </div>
      )}
    </>
  )
}
