"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { trackAgeVote } from "@/lib/analytics"

const SAGE = "#5C8A5C"

interface AgeVoteButtonProps {
  mediaId: string
  className?: string
}

interface VoteData {
  agrees: number
  disagrees: number
  total: number
  agreePercent: number | null
  userVote: { agree: boolean; suggestedAge: number | null } | null
}

export function AgeVoteButton({ mediaId, className }: AgeVoteButtonProps) {
  const { data: session } = useSession()
  const [data, setData] = useState<VoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/media/${mediaId}/age-vote`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mediaId])

  const handleVote = async (agree: boolean) => {
    if (!session?.user) return
    setSubmitting(true)
    trackAgeVote(agree)

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      const wasAgree = prev.userVote?.agree
      const hadVote = prev.userVote !== null

      let agrees = prev.agrees
      let disagrees = prev.disagrees

      // Remove previous vote
      if (hadVote) {
        if (wasAgree) agrees--
        else disagrees--
      }

      // If clicking same vote, just remove it
      if (hadVote && wasAgree === agree) {
        const total = agrees + disagrees
        return {
          agrees,
          disagrees,
          total,
          agreePercent: total > 0 ? Math.round((agrees / total) * 100) : null,
          userVote: null,
        }
      }

      // Add new vote
      if (agree) agrees++
      else disagrees++

      const total = agrees + disagrees
      return {
        agrees,
        disagrees,
        total,
        agreePercent: total > 0 ? Math.round((agrees / total) * 100) : null,
        userVote: { agree, suggestedAge: null },
      }
    })

    try {
      await fetch(`/api/media/${mediaId}/age-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agree }),
      })
    } catch {
      // Revert on error
      const res = await fetch(`/api/media/${mediaId}/age-vote`)
      const fresh = await res.json()
      setData(fresh)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!data) return null

  const p = APERCU_PALETTE
  const showBadge = data.total >= 5 && data.agreePercent !== null && data.agreePercent >= 70

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Confidence badge */}
      {showBadge && (
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: "rgba(92, 138, 92, 0.14)",
            color: SAGE,
          }}
        >
          {data.agreePercent}% confirment
        </span>
      )}

      {/* Vote buttons */}
      {session?.user ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVote(true)}
            disabled={submitting}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all"
            style={{
              background:
                data.userVote?.agree === true
                  ? "rgba(92, 138, 92, 0.18)"
                  : "transparent",
              color: data.userVote?.agree === true ? SAGE : p.ink2,
            }}
            title="Cette recommandation d'âge est correcte"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ThumbsUp className="h-3 w-3" />
            )}
            {data.agrees > 0 && <span>{data.agrees}</span>}
          </button>

          <button
            onClick={() => handleVote(false)}
            disabled={submitting}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all"
            style={{
              background:
                data.userVote?.agree === false
                  ? "rgba(209, 106, 74, 0.14)"
                  : "transparent",
              color: data.userVote?.agree === false ? p.accent : p.ink2,
            }}
            title="Cette recommandation d'âge est incorrecte"
          >
            <ThumbsDown className="h-3 w-3" />
            {data.disagrees > 0 && <span>{data.disagrees}</span>}
          </button>
        </div>
      ) : (
        // Not logged in — show counts only
        data.total > 0 && (
          <span className="text-[11px]" style={{ color: p.ink2 }}>
            {data.total} vote{data.total > 1 ? "s" : ""}
          </span>
        )
      )}
    </div>
  )
}
