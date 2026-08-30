"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Bookmark, Check, Link2, Loader2, Vote } from "lucide-react"

type Status = "idle" | "sharing" | "shared" | "saving" | "saved" | "voting" | "error"

/**
 * Turns the board on screen into something you can send or keep.
 *
 * The request carries only the question and the current filters — the server
 * rebuilds the interpretation and the plan from its own cache, so this button
 * cannot be used to store arbitrary content under a Totem URL, and creating a
 * board never costs an interpretation call.
 */
export function ShareSaveBar({ query, isLoggedIn }: { query: string; isLoggedIn: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>("idle")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)

  const params = Object.fromEntries(searchParams.entries())

  async function createBoard(mode: "share" | "save", boardTitle?: string, thenVote = false) {
    setError(null)
    setStatus(thenVote ? "voting" : mode === "share" ? "sharing" : "saving")
    try {
      const response = await fetch("/api/decouverte/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, params, mode, title: boardTitle ?? null }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Une erreur est survenue.")
        setStatus("error")
        return
      }

      const absolute = `${window.location.origin}${data.url}`
      if (thenVote) {
        // The ballot lives on the shared board: create it and go straight
        // there, ready to place badges and pass the phone around.
        router.push(data.url)
        return
      }
      if (mode === "share") {
        setShareUrl(absolute)
        // Native share sheet on mobile, clipboard everywhere else. Both can be
        // refused, so the link is also rendered below as a fallback.
        try {
          if (navigator.share) await navigator.share({ url: absolute, title: "Un tableau Totem Avisé" })
          else await navigator.clipboard.writeText(absolute)
        } catch {
          // The link stays visible — nothing else to do.
        }
        setStatus("shared")
      } else {
        setNaming(false)
        setStatus("saved")
      }
    } catch {
      setError("Une erreur est survenue.")
      setStatus("error")
    }
  }

  const busy = status === "sharing" || status === "saving" || status === "voting"

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => createBoard("share", undefined, true)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--pine)" }}
        >
          {status === "voting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
          Voter en famille
        </button>
        <button
          type="button"
          onClick={() => createBoard("share")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
        >
          {status === "sharing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "shared" ? (
            <Check className="h-4 w-4" style={{ color: "var(--pine-2)" }} />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {status === "shared" ? "Lien copié" : "Partager ce tableau"}
        </button>

        {isLoggedIn && !naming && status !== "saved" && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            <Bookmark className="h-4 w-4" />
            Enregistrer
          </button>
        )}

        {status === "saved" && (
          <span className="inline-flex items-center gap-2 text-[13.5px] font-bold" style={{ color: "var(--pine-2)" }}>
            <Check className="h-4 w-4" />
            Enregistré dans vos tableaux
          </span>
        )}
      </div>

      {naming && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom du tableau (ex. Soirée ciné du samedi)"
            aria-label="Nom du tableau"
            maxLength={80}
            className="min-w-0 flex-1 rounded-full px-4 py-2 text-[13.5px] outline-none sm:max-w-[380px]"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={() => createBoard("save", title.trim() || undefined)}
            disabled={busy}
            className="rounded-full px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--terra)" }}
          >
            {status === "saving" ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="text-[13px] font-semibold transition-opacity hover:opacity-75"
            style={{ color: "var(--ink-3)" }}
          >
            Annuler
          </button>
        </div>
      )}

      {shareUrl && (
        <p className="mt-2 break-all text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {shareUrl}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--terra)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
