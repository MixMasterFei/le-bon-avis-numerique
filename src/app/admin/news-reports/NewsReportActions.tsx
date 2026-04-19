"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export function NewsReportActions({
  reportId,
  commentStatus,
}: {
  reportId: string
  commentStatus: "VISIBLE" | "HIDDEN" | "DELETED"
}) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<null | string>(null)

  async function perform(action: "hide" | "dismiss" | "restore") {
    setPending(action)
    try {
      await fetch(`/api/admin/news-reports/${reportId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      startTransition(() => router.refresh())
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {commentStatus !== "HIDDEN" && (
        <button
          type="button"
          onClick={() => perform("hide")}
          disabled={pending !== null}
          className="text-xs px-3 py-1.5 rounded-full font-semibold disabled:opacity-50"
          style={{ background: p.accent, color: "#fff" }}
        >
          {pending === "hide" ? "…" : "Masquer le commentaire"}
        </button>
      )}
      {commentStatus === "HIDDEN" && (
        <button
          type="button"
          onClick={() => perform("restore")}
          disabled={pending !== null}
          className="text-xs px-3 py-1.5 rounded-full font-semibold disabled:opacity-50"
          style={{ background: p.accent2, color: "#fff" }}
        >
          {pending === "restore" ? "…" : "Restaurer"}
        </button>
      )}
      <button
        type="button"
        onClick={() => perform("dismiss")}
        disabled={pending !== null}
        className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50"
        style={{ color: p.ink2, border: `1px solid ${p.line}` }}
      >
        {pending === "dismiss" ? "…" : "Ignorer le signalement"}
      </button>
    </div>
  )
}
