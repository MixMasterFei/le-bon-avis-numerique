"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { ThumbsUp, ThumbsDown, Check } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import { DISLIKE_REASONS, MAX_REASON_NOTE_LENGTH } from "@/lib/news-feedback"
import { useNewsFeedback, updateNewsFeedbackCache } from "@/hooks/useNewsFeedback"

type Verdict = "LIKE" | "DISLIKE"

/**
 * Compact "was this useful for your family?" buttons on news feed cards —
 * the news equivalent of the poster action bar. One tap records LIKE /
 * DISLIKE (per user, toggleable); a DISLIKE opens an OPTIONAL reason row
 * (fixed chips + free text) that feeds the reader-signals section of the
 * news pipeline, so future selections learn what families found inadequate.
 *
 * Logged-out visitors see the buttons; tapping shows a one-line sign-in
 * nudge (content stays visible — only the feedback needs an account).
 */
export function NewsFeedbackInline({ slug }: { slug: string }) {
  const p = APERCU_PALETTE
  const { data: session } = useSession()
  const pathname = usePathname()
  const loggedIn = !!session?.user
  const userId = session?.user?.id ?? null

  const preloaded = useNewsFeedback(loggedIn, userId)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reasonSent, setReasonSent] = useState(false)
  const [note, setNote] = useState("")
  const [showLoginNudge, setShowLoginNudge] = useState(false)
  const touched = useRef(false)
  // Requests are serialized: the "dislike" write and the follow-up
  // "dislike + reason" write must reach the server in order, or a network
  // reordering makes the reasonless one read the other's row as a toggle-off.
  const requestChain = useRef<Promise<unknown>>(Promise.resolve())

  // Seed from the shared preload (one fetch for the whole feed); never
  // clobber a fresh optimistic tap.
  useEffect(() => {
    if (!preloaded || touched.current) return
    const mine = preloaded[slug]
    if (mine !== "LIKE" && mine !== "DISLIKE") return
    // Deferred out of the effect body (repo lint rule: no synchronous
    // setState in effects — avoids cascading renders on feed hydration).
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled && !touched.current) setVerdict(mine)
    })
    return () => {
      cancelled = true
    }
  }, [preloaded, slug])

  // Returns true only when the server ACCEPTED the write — a 4xx/5xx does
  // not reject fetch, and treating it as success left the UI showing
  // "Merci !" over a write that never happened.
  const send = (body: Record<string, unknown>): Promise<boolean> => {
    const chained = requestChain.current.then(async () => {
      try {
        const res = await fetch(`/api/news/${encodeURIComponent(slug)}/engagement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reaction", ...body }),
        })
        return res.ok
      } catch {
        return false
      }
    })
    requestChain.current = chained
    return chained
  }

  const tap = (next: Verdict) => {
    if (!loggedIn) {
      setShowLoginNudge(true)
      return
    }
    touched.current = true
    const previous = verdict
    const removing = verdict === next
    setVerdict(removing ? null : next)
    setReasonOpen(!removing && next === "DISLIKE")
    setReasonSent(false)
    // Toggle-off is explicit — the client knows its own state; the server
    // never has to infer intent from a missing reason.
    void send({ type: next, remove: removing }).then((ok) => {
      if (ok) {
        updateNewsFeedbackCache(slug, removing ? null : next)
      } else {
        // Visible rollback — the optimistic state lied.
        setVerdict(previous)
        setReasonOpen(false)
      }
    })
  }

  const sendReason = (code: string) => {
    touched.current = true
    setReasonSent(true)
    setReasonOpen(false)
    void send({ type: "DISLIKE", reasonCode: code, reasonNote: note.trim() || undefined }).then(
      (ok) => {
        // The dislike itself may already be stored; only the "Merci !" for
        // the reason must not lie.
        if (!ok) setReasonSent(false)
      },
    )
  }

  const btn = (kind: Verdict, Icon: typeof ThumbsUp, label: string) => {
    const active = verdict === kind
    return (
      <button
        type="button"
        onClick={() => tap(kind)}
        aria-label={label}
        aria-pressed={active}
        title={label}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-all active:scale-90"
        style={{
          background: active ? (kind === "LIKE" ? "#5C8A5C" : p.ink) : "transparent",
          color: active ? "#fff" : p.ink2,
          border: `1px solid ${active ? "transparent" : p.line}`,
        }}
      >
        <Icon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium" style={{ color: p.ink2 }}>
          Utile&nbsp;?
        </span>
        {btn("LIKE", ThumbsUp, "Utile pour ma famille")}
        {btn("DISLIKE", ThumbsDown, "Pas pour nous")}
        {reasonSent && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: "#5C8A5C" }}>
            <Check className="h-3 w-3" /> Merci&nbsp;!
          </span>
        )}
      </div>

      {showLoginNudge && !loggedIn && (
        <p className="mt-1.5 text-[11px]" style={{ color: p.ink2 }}>
          <Link
            href={`/connexion?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
            className="font-semibold underline underline-offset-2"
            style={{ color: p.ink }}
          >
            Connectez-vous
          </Link>{" "}
          pour nous aider à adapter les actus à votre famille.
        </p>
      )}

      {/* Optional reason — helps the pipeline learn WHY it missed. Fully
          skippable: the dislike is already recorded. */}
      {reasonOpen && verdict === "DISLIKE" && (
        <div className="mt-2 rounded-lg p-2" style={{ background: p.bg2, border: `1px solid ${p.line}` }}>
          <div className="mb-1.5 text-[10.5px] font-semibold" style={{ color: p.ink2 }}>
            Pourquoi&nbsp;? (facultatif — ça nous aide à mieux choisir)
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(DISLIKE_REASONS).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => sendReason(code)}
                className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: p.card, color: p.ink, border: `1px solid ${p.line}` }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_REASON_NOTE_LENGTH}
            placeholder="Précisez si vous voulez…"
            className="mt-1.5 w-full rounded-md px-2 py-1 text-[11px] outline-none"
            style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && note.trim()) sendReason("autre")
            }}
          />
          <button
            type="button"
            onClick={() => setReasonOpen(false)}
            className="mt-1 text-[10px] underline underline-offset-2 opacity-60 hover:opacity-100"
            style={{ color: p.ink2 }}
          >
            Passer
          </button>
        </div>
      )}
    </div>
  )
}
