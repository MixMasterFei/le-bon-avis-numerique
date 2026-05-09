"use client"

import { useState, type FormEvent } from "react"
import { ThumbsUp, ThumbsDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TotemFeedbackButtonsProps {
  onSubmit: (rating: "UP" | "DOWN", reason?: string) => Promise<void>
}

export function TotemFeedbackButtons({ onSubmit }: TotemFeedbackButtonsProps) {
  const [picked, setPicked] = useState<"UP" | "DOWN" | null>(null)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handlePick = async (rating: "UP" | "DOWN") => {
    if (submitting) return
    setPicked(rating)
    if (rating === "DOWN") {
      // Open optional reason field — fire UP/DOWN immediately so we
      // don't lose the signal if the user skips the reason.
      setShowReason(true)
      setSubmitting(true)
      try {
        await onSubmit(rating)
      } finally {
        setSubmitting(false)
      }
    } else {
      setSubmitting(true)
      try {
        await onSubmit(rating)
        setDone(true)
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleReasonSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting || !picked) return
    setSubmitting(true)
    try {
      await onSubmit(picked, reason.trim() || undefined)
      setDone(true)
      setShowReason(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mt-1 text-[11px] italic" style={{ color: "var(--color-ink2)" }}>
        Merci, c&apos;est noté.
      </div>
    )
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handlePick("UP")}
          disabled={submitting}
          aria-label="Bonne réponse"
          className={cn(
            "rounded-md p-1 transition disabled:opacity-50",
            picked === "UP"
              ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
              : "hover:bg-black/5",
          )}
          style={picked !== "UP" ? { color: "var(--color-ink2)" } : undefined}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handlePick("DOWN")}
          disabled={submitting}
          aria-label="Réponse à améliorer"
          className={cn(
            "rounded-md p-1 transition disabled:opacity-50",
            picked === "DOWN"
              ? "bg-amber-500/15 text-amber-700"
              : "hover:bg-black/5",
          )}
          style={picked !== "DOWN" ? { color: "var(--color-ink2)" } : undefined}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {showReason && (
        <form onSubmit={handleReasonSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="Qu'est-ce qui n'allait pas ? (optionnel)"
            maxLength={200}
            autoFocus
            className="flex-1 rounded-md border px-2 py-1 text-xs"
            style={{
              borderColor: "var(--color-line)",
              background: "var(--color-card)",
              color: "var(--color-ink)",
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            Envoyer
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReason(false)
              setDone(true)
            }}
            disabled={submitting}
            aria-label="Passer"
            className="rounded-md p-1 transition hover:bg-black/5"
            style={{ color: "var(--color-ink2)" }}
          >
            <X className="h-3 w-3" />
          </button>
        </form>
      )}
    </div>
  )
}

