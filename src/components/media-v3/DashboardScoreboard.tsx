"use client"

import { useCallback, useState } from "react"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { UserMetricsButton } from "@/components/media/UserMetricsButton"
import { DashboardKpiStrip, buildScoreboardCells, type MetricsLike } from "./DashboardKpiStrip"

type Mode = "totem" | "community"

interface CommunityResponse {
  hasData: boolean
  averages: MetricsLike | null
  count?: number
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
  const [justSubmitted, setJustSubmitted] = useState(false)

  // `fresh` bypasses the community-metrics CDN cache (s-maxage=300) so a
  // parent's just-submitted vote shows immediately instead of up to 5 min later.
  const loadCommunity = useCallback(
    (fresh = false) => {
      setCommunityRequested(true)
      const url = `/api/media/${mediaId}/community-metrics${fresh ? `?t=${Date.now()}` : ""}`
      fetch(url, fresh ? { cache: "no-store" } : undefined)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCommunity(d))
        .catch(() => {})
    },
    [mediaId],
  )

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

  // After a parent submits their rating: their vote feeds the community
  // averages, not the Totem/expert view — so jump to the Communauté tab (past
  // the cache) and confirm, otherwise the submission looks like it did nothing.
  const handleMetricsSubmit = useCallback(() => {
    setMode("community")
    loadCommunity(true)
    setJustSubmitted(true)
    window.setTimeout(() => setJustSubmitted(false), 4500)
  }, [loadCommunity])

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
          <span className="text-[11.5px]" style={{ color: justSubmitted ? "var(--f-green)" : "var(--f-muted)" }}>
            {justSubmitted
              ? "✓ Merci — votre évaluation est enregistrée, elle est incluse dans la moyenne ci-dessus."
              : communityHasData
                ? `Moyenne de ${community?.count ?? 0} évaluation${(community?.count ?? 0) > 1 ? "s" : ""} de parents.`
                : "Pas encore d'avis communautaire — soyez le premier, votre évaluation apparaîtra aussitôt."}
          </span>
          <UserMetricsButton mediaId={mediaId} mediaTitle={mediaTitle} onSubmit={handleMetricsSubmit} />
        </div>
      )}
    </>
  )
}
