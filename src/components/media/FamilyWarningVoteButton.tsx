"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { ShieldAlert, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FamilyWarningVoteButtonProps {
  mediaId: string
  className?: string
}

interface VoteData {
  flagCount: number
  userHasFlagged: boolean
  threshold: number
}

export function FamilyWarningVoteButton({ mediaId, className }: FamilyWarningVoteButtonProps) {
  const { data: session } = useSession()
  const [data, setData] = useState<VoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/media/${mediaId}/family-warning-vote`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mediaId])

  const handleToggle = async () => {
    if (!session?.user || !data) return
    setSubmitting(true)

    const newFlag = !data.userHasFlagged

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        flagCount: newFlag ? prev.flagCount + 1 : prev.flagCount - 1,
        userHasFlagged: newFlag,
      }
    })

    try {
      const res = await fetch(`/api/media/${mediaId}/family-warning-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: newFlag }),
      })
      if (!res.ok) {
        // Revert on error
        const fresh = await fetch(`/api/media/${mediaId}/family-warning-vote`)
        setData(await fresh.json())
      }
    } catch {
      // Revert on error
      const fresh = await fetch(`/api/media/${mediaId}/family-warning-vote`)
      setData(await fresh.json())
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data) return null

  // Don't show for users without family members (they'll get a 403 anyway)
  // But do show the count for non-logged-in users if there are flags
  const isLoggedIn = !!session?.user

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isLoggedIn ? (
        <button
          onClick={handleToggle}
          disabled={submitting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            data.userHasFlagged
              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          )}
          title={
            data.userHasFlagged
              ? "Retirer votre signalement famille"
              : "Signaler ce contenu comme sensible pour les familles"
          }
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          <span>
            {data.userHasFlagged ? "Signalé" : "Signaler"}
          </span>
          {data.flagCount > 0 && (
            <span className="text-[10px] opacity-70">
              ({data.flagCount})
            </span>
          )}
        </button>
      ) : (
        data.flagCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            {data.flagCount} signalement{data.flagCount > 1 ? "s" : ""}
          </span>
        )
      )}
    </div>
  )
}
