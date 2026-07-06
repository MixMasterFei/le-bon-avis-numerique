"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { AlertTriangle, Check, X, Loader2 } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { useTriggerVotes, type CategoryConsensus } from "./FicheDataContext"

const SAGE = "#5C8A5C"

function emptyConsensus(): CategoryConsensus {
  return { present: 0, absent: 0, total: 0, presentPercent: null, userVote: null }
}

/**
 * One sensitive-warning category, rendered as a stateful chip on the fiche.
 * Closes the loop the AI opened: parents confirm ("Confirmer") or reject
 * ("Pas dans ce film") the flag in place.
 *
 * Three visual states, driven purely by community consensus (Phase-1 two-tier
 * framing):
 *  - AI-only / hedged  → muted amber chip ("à surveiller")
 *  - confirmed         → sage chip + "{percent}% confirment" badge (verified)
 *  - rejected          → muted, struck foot-note line (AI false positive overturned)
 *
 * Optimistic, no refetch — mirrors AgeVoteButton. Consensus comes from the
 * shared FicheDataContext fetch.
 */
export function TriggerChip({
  mediaId,
  category,
  seedUserVote,
}: {
  mediaId: string
  category: string
  /** True when the chip was just added via the "signaler un élément" picker —
   *  the submitter's "présent" vote is already recorded server-side, so the
   *  chip starts from that state instead of an empty consensus. */
  seedUserVote?: boolean
}) {
  const { data: session } = useSession()
  const { data } = useTriggerVotes(mediaId)
  const p = APERCU_PALETTE

  const threshold = data?.threshold ?? { minVotes: 5, minPercent: 70 }
  const consensus = data?.categories[category] ?? null
  const [local, setLocal] = useState<CategoryConsensus | null>(
    seedUserVote
      ? { present: 1, absent: 0, total: 1, presentPercent: 100, userVote: true }
      : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [needFamily, setNeedFamily] = useState(false)

  const view: CategoryConsensus = local ?? consensus ?? emptyConsensus()

  const meetsQuorum = view.total >= threshold.minVotes && view.presentPercent !== null
  const confirmed = meetsQuorum && (view.presentPercent as number) >= threshold.minPercent
  const rejected = meetsQuorum && (view.presentPercent as number) <= 100 - threshold.minPercent

  const vote = async (next: boolean) => {
    if (!session?.user || submitting) return
    setSubmitting(true)
    setNeedFamily(false)

    const clearing = view.userVote === next // re-tapping the active choice clears it

    // Optimistic update from the current view.
    setLocal(() => {
      const cur = local ?? consensus ?? emptyConsensus()
      let present = cur.present
      let absent = cur.absent
      if (cur.userVote === true) present--
      else if (cur.userVote === false) absent--
      let userVote: boolean | null
      if (clearing) {
        userVote = null
      } else {
        if (next) present++
        else absent++
        userVote = next
      }
      const total = present + absent
      return {
        present,
        absent,
        total,
        presentPercent: total > 0 ? Math.round((present / total) * 100) : null,
        userVote,
      }
    })

    try {
      const res = await fetch(`/api/media/${mediaId}/trigger-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, present: clearing ? null : next }),
      })
      if (res.status === 403) {
        setNeedFamily(true)
        setLocal(consensus) // revert — not a parent
      } else if (!res.ok) {
        setLocal(consensus)
      }
    } catch {
      setLocal(consensus) // revert on network error
    } finally {
      setSubmitting(false)
    }
  }

  // ── Community-rejected: collapse to a muted, struck foot-note line ──
  if (rejected) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[12.5px] italic"
        style={{ color: p.ink2, opacity: 0.7 }}
        title="Les parents n'ont pas confirmé ce point"
      >
        <X className="h-3 w-3 shrink-0" />
        <span style={{ textDecoration: "line-through" }}>{category}</span>
        <span className="not-italic">— non confirmé par les parents</span>
      </span>
    )
  }

  const accentColor = confirmed ? SAGE : p.accent
  const chipBg = confirmed ? "rgba(92, 138, 92, 0.10)" : p.bg
  const chipBorder = confirmed ? "rgba(92, 138, 92, 0.45)" : p.line2

  return (
    <span
      className="inline-flex flex-col gap-1 rounded-2xl px-3.5 py-2"
      style={{ background: chipBg, border: `1px solid ${chipBorder}` }}
    >
      <span className="inline-flex items-center gap-2 text-[14px]" style={{ color: p.ink2 }}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        {category}
        {confirmed && (
          <span
            className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(92, 138, 92, 0.16)", color: SAGE }}
          >
            {view.presentPercent}% confirment
          </span>
        )}
      </span>

      {/* Vote affordance */}
      {session?.user ? (
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => vote(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-all"
            style={{
              background: view.userVote === true ? "rgba(92, 138, 92, 0.18)" : "transparent",
              color: view.userVote === true ? SAGE : p.ink2,
            }}
            aria-label={`Confirmer : ${category}`}
            title="Présent dans ce film"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Confirmer{view.present > 0 ? ` · ${view.present}` : ""}
          </button>
          <button
            type="button"
            onClick={() => vote(false)}
            disabled={submitting}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-all"
            style={{
              background: view.userVote === false ? "rgba(209, 106, 74, 0.14)" : "transparent",
              color: view.userVote === false ? p.accent : p.ink2,
            }}
            aria-label={`Pas dans ce film : ${category}`}
            title="Pas présent dans ce film"
          >
            <X className="h-3 w-3" />
            Pas dans ce film{view.absent > 0 ? ` · ${view.absent}` : ""}
          </button>
        </span>
      ) : (
        view.total > 0 && (
          <span className="text-[11px]" style={{ color: p.ink2 }}>
            {view.total} avis parent{view.total > 1 ? "s" : ""}
          </span>
        )
      )}

      {needFamily && (
        <span className="text-[11px]" style={{ color: p.accent }}>
          Ajoutez un profil famille pour participer.
        </span>
      )}
    </span>
  )
}
