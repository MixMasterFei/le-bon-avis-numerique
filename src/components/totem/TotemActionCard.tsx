"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TotemActionCardProps {
  toolCallId: string
  path: string
  label: string
  reason: string
  resolved?: { accepted: boolean }
  autoMode?: boolean
  onAccept: (toolCallId: string, path: string) => void
  onDecline: (toolCallId: string) => void
}

export function TotemActionCard({
  toolCallId,
  path,
  label,
  reason,
  resolved,
  autoMode = false,
  onAccept,
  onDecline,
}: TotemActionCardProps) {
  const [busy, setBusy] = useState(false)
  const isResolved = !!resolved
  const autoFiredRef = useRef(false)

  // Auto-mode: when the user has opted into proactive navigation, fire
  // the accept on mount as soon as the card appears with both input
  // ready and no resolution yet. Tracked by ref so we don't re-fire on
  // re-renders. The setBusy is deferred to the next microtask so the
  // effect body itself stays free of synchronous state writes
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!autoMode || isResolved || autoFiredRef.current) return
    if (!toolCallId || !path) return
    autoFiredRef.current = true
    onAccept(toolCallId, path)
    queueMicrotask(() => setBusy(true))
  }, [autoMode, isResolved, toolCallId, path, onAccept])

  const handleAccept = () => {
    if (busy || isResolved) return
    setBusy(true)
    onAccept(toolCallId, path)
  }
  const handleDecline = () => {
    if (busy || isResolved) return
    setBusy(true)
    onDecline(toolCallId)
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-amber-50/60 p-3 text-sm",
        "border-amber-200",
      )}
    >
      <div className="text-xs italic text-amber-900/80">{reason}</div>
      <div className="mt-1 flex items-center gap-1 font-semibold text-amber-950">
        <ArrowRight className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-[11px] text-amber-900/60">{path}</div>

      {isResolved ? (
        <div className="mt-2 text-xs text-amber-900/70">
          {resolved!.accepted ? "✓ En route…" : "Pas de souci, on reste là."}
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
            Oui, emmenez-moi
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
