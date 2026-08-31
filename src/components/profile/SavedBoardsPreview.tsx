"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles, Trash2 } from "lucide-react"
import { APERCU_PALETTE as p } from "@/components/home-v2/apercuTheme"

interface SavedBoard {
  id: string
  title: string | null
  query: string
  createdAt: string
}

/**
 * Boards the user kept from Recherche magique.
 *
 * Renders nothing at all when there are none — the feature is still rolling
 * out, so an empty section here would be furniture for most accounts.
 */
export function SavedBoardsPreview() {
  const [boards, setBoards] = useState<SavedBoard[] | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/decouverte/board")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setBoards(Array.isArray(data?.items) ? data.items : [])
      })
      .catch(() => {
        if (!cancelled) setBoards([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function remove(id: string) {
    setRemoving(id)
    try {
      const response = await fetch(`/api/decouverte/board?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (response.ok) setBoards((current) => (current ?? []).filter((b) => b.id !== id))
    } finally {
      setRemoving(null)
    }
  }

  if (boards === null || boards.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: p.accent }} />
        <h3 className="text-lg font-semibold" style={{ color: p.ink }}>
          Mes tableaux
        </h3>
      </div>
      <p className="mt-1 text-sm" style={{ color: p.ink2 }}>
        Vos sélections gardées. Elles se recomposent à chaque ouverture, avec les âges du jour.
      </p>

      <ul className="mt-4 space-y-2">
        {boards.map((board) => (
          <li
            key={board.id}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <Link href={`/tableau/${board.id}`} className="min-w-0 flex-1 transition-opacity hover:opacity-75">
              <span className="block truncate text-sm font-semibold" style={{ color: p.ink }}>
                {board.title ?? board.query}
              </span>
              {board.title && (
                <span className="block truncate text-xs" style={{ color: p.ink2 }}>
                  « {board.query} »
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => remove(board.id)}
              disabled={removing === board.id}
              aria-label={`Supprimer le tableau ${board.title ?? board.query}`}
              className="shrink-0 rounded-full p-2 transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: p.ink2 }}
            >
              {removing === board.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
