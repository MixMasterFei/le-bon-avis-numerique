"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

const MAX = 1500

export function NewsCommentComposer({ slug }: { slug: string }) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/news/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de l'envoi")
      } else {
        setBody("")
        startTransition(() => router.refresh())
      }
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX - body.length

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={MAX}
        placeholder="Partagez votre avis sur cette actualité…"
        className="w-full text-sm rounded-lg p-2.5 outline-none resize-y"
        style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
      />
      {error && (
        <p className="text-xs mt-1" style={{ color: p.accent }}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px]" style={{ color: p.ink2 }}>
          {remaining} caractères restants
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || body.trim().length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
          style={{ background: p.ink, color: p.bg }}
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? "Envoi…" : "Publier"}
        </button>
      </div>
    </div>
  )
}
