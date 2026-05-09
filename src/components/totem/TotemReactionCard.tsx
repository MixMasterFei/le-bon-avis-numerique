"use client"

import { useState } from "react"
import { Heart, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

const REACTION_LABELS: Record<string, string> = {
  LOVED: "adoré",
  LIKED: "aimé",
  WATCHED: "vu",
  OK: "ok",
  SCARED: "fait peur",
  BORED: "ennuyé",
  TOO_YOUNG: "trop jeune",
  TOO_OLD: "trop vieux",
}

export interface TotemReactionCardProps {
  toolCallId: string
  mediaId: string
  mediaTitle: string
  familyMemberId: string
  familyMemberName: string
  reaction: string
  resolved?: { accepted: boolean; reason?: string }
  onAccept: (
    toolCallId: string,
    input: { mediaId: string; familyMemberId: string; reaction: string },
  ) => Promise<void> | void
  onDecline: (toolCallId: string) => void
}

export function TotemReactionCard({
  toolCallId,
  mediaId,
  mediaTitle,
  familyMemberId,
  familyMemberName,
  reaction,
  resolved,
  onAccept,
  onDecline,
}: TotemReactionCardProps) {
  const [busy, setBusy] = useState(false)
  const isResolved = !!resolved
  const reactionLabel = REACTION_LABELS[reaction] ?? reaction.toLowerCase()

  const handleAccept = async () => {
    if (busy || isResolved) return
    setBusy(true)
    await onAccept(toolCallId, { mediaId, familyMemberId, reaction })
    setBusy(false)
  }

  const handleDecline = () => {
    if (busy || isResolved) return
    onDecline(toolCallId)
  }

  return (
    <div
      className={cn("rounded-xl border bg-amber-50/60 p-3 text-sm", "border-amber-200")}
    >
      <div className="flex items-start gap-2">
        <Heart className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="text-xs italic text-amber-900/80">
            Marquer comme <em>{reactionLabel}</em> par {familyMemberName} ?
          </div>
          <div className="mt-1 truncate font-semibold text-amber-950">{mediaTitle}</div>
        </div>
      </div>

      {isResolved ? (
        <div className="mt-2 text-xs text-amber-900/80">
          {resolved!.accepted && `✓ Réaction enregistrée pour ${familyMemberName}`}
          {!resolved!.accepted && resolved!.reason === "user_declined" && "Pas de souci, je laisse."}
          {!resolved!.accepted &&
            resolved!.reason !== "user_declined" &&
            "Une difficulté est survenue. Réessayez plus tard."}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Non merci
          </button>
        </div>
      )}
    </div>
  )
}
