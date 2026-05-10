"use client"

import { useEffect, useState } from "react"
import { Loader2, MessageSquare, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationListItem {
  id: string
  startedAt: string
  lastMessageAt: string
  sourcePage: string | null
  messageCount: number
  preview: string
}

export interface TotemHistoryPanelProps {
  activeConversationId?: string
  onPick: (id: string) => void
  onDeleted?: (id: string) => void
  onClose: () => void
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function TotemHistoryPanel({ activeConversationId, onPick, onDeleted }: TotemHistoryPanelProps) {
  const [items, setItems] = useState<ConversationListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetch("/api/totem/conversations", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status_${res.status}`)
        const data = (await res.json()) as { conversations: ConversationListItem[] }
        if (!cancelled) setItems(data.conversations)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="px-4 py-6 text-sm" style={{ color: "var(--color-ink2)" }}>
        Impossible de charger l&apos;historique pour l&apos;instant.
      </div>
    )
  }

  if (items === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm" style={{ color: "var(--color-ink2)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Chargement…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-sm" style={{ color: "var(--color-ink2)" }}>
        Aucune conversation enregistrée pour l&apos;instant.
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/totem/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        console.error("[totem] delete failed", res.status)
        return
      }
      setItems((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
      onDeleted?.(id)
    } catch (err) {
      console.error("[totem] delete error", err)
    } finally {
      setDeletingId(null)
      setPendingDeleteId(null)
    }
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--color-line)" }}>
      {items.map((c) => {
        const active = c.id === activeConversationId
        const isPendingDelete = pendingDeleteId === c.id
        const isDeleting = deletingId === c.id
        return (
          <li key={c.id} className="group relative">
            <button
              type="button"
              onClick={() => !isPendingDelete && !isDeleting && onPick(c.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 pr-12 text-left transition-colors hover:bg-black/5",
                active && "bg-[var(--color-accent)]/8",
                isDeleting && "opacity-50",
              )}
              style={{ borderColor: "var(--color-line)" }}
              disabled={isDeleting}
            >
              <span
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: active ? "var(--color-accent)" : "var(--color-bg2)",
                  color: active ? "#fff" : "var(--color-ink2)",
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                  {c.preview}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--color-ink2)" }}>
                  <span>{formatRelative(c.lastMessageAt)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {c.messageCount} message{c.messageCount > 1 ? "s" : ""}
                  </span>
                </span>
              </span>
            </button>

            {/* Delete affordance — confirm-on-click, two-step */}
            {isPendingDelete ? (
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={isDeleting}
                  className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  disabled={isDeleting}
                  className="rounded-md border px-2 py-1 text-[11px] font-medium transition hover:bg-black/5 disabled:opacity-50"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink2)" }}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPendingDeleteId(c.id)
                }}
                aria-label="Supprimer cette conversation"
                title="Supprimer"
                // On touch devices :hover doesn't fire reliably, so show
                // the trash at reduced opacity by default on mobile and
                // boost to 100% on hover/focus on desktop.
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 opacity-60 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                style={{ color: "var(--color-ink2)" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
