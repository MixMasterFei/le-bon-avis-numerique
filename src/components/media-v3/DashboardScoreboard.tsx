"use client"

import { useCallback, useState } from "react"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { UserMetricsButton } from "@/components/media/UserMetricsButton"
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
 * then the strip below reflecting the selected source. In Communauté mode a
 * footer invites the viewer to add/edit their own content rating
 * (UserMetricsButton → same submission that feeds the averages), and the strip
 * refreshes after they submit. Community averages come from
 * /api/media/[id]/community-metrics (same source as the classic fiche).
 */
export function DashboardScoreboard({
  mediaId,
  mediaTitle,
  expertMetrics,
  topics,
  reviewCount = 0,
}: {
  mediaId: string
  mediaTitle: string
  expertMetrics: MetricsLike
  topics: string[]
  /** Written avis count — surfaces "Avis (N)" in the actions row. */
  reviewCount?: number
}) {
  const [mode, setMode] = useState<Mode>("totem")
  const [community, setCommunity] = useState<CommunityResponse | null>(null)
  const [communityRequested, setCommunityRequested] = useState(false)

  const loadCommunity = useCallback(() => {
    setCommunityRequested(true)
    fetch(`/api/media/${mediaId}/community-metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCommunity(d))
      .catch(() => {})
  }, [mediaId])

  // Deferred: the default view is Totem (expert metrics already in hand), so the
  // community fetch fires only when the viewer first opens the Communauté tab —
  // not on every page load.
  const selectMode = useCallback(
    (m: Mode) => {
      setMode(m)
      if (m === "community" && !communityRequested) loadCommunity()
    },
    [communityRequested, loadCommunity],
  )

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
        onClick={() => selectMode(m)}
        className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
        style={
          active
            ? { background: "var(--f-ink)", color: "var(--f-card)", boxShadow: "0 1px 2px rgba(42,37,31,.22)" }
            : { color: "var(--f-mid)", background: "transparent" }
        }
      >
        {label}
      </button>
    )
  }

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
        style={{ borderTop: "1px solid var(--f-divider)" }}
      >
        <MediaPageClient mediaId={mediaId} mediaTitle={mediaTitle} showActions reviewCount={reviewCount} />
        <div className="inline-flex items-center rounded-[10px] p-1" style={{ background: "var(--f-track)" }}>
          {seg("totem", "Totem Avisé")}
          {seg("community", "Communauté")}
        </div>
      </div>

      <DashboardKpiStrip cells={cells} />

      {mode === "community" && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
          style={{ background: "var(--f-inset)", borderTop: "1px solid var(--f-divider)" }}
        >
          <span className="text-[11.5px]" style={{ color: "var(--f-muted)" }}>
            {communityHasData
              ? "Moyenne des évaluations de la communauté."
              : "Pas encore d'avis communautaire — partagez le vôtre."}
          </span>
          <UserMetricsButton mediaId={mediaId} mediaTitle={mediaTitle} onSubmit={loadCommunity} />
        </div>
      )}
    </>
  )
}
