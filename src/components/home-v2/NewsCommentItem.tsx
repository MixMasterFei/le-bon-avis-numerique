"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Flag, Pencil, Trash2, X, Check } from "lucide-react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import type { HydratedComment, NewsReactionType } from "@/lib/news-comments"

const REACTION_BUTTONS: Array<{ type: NewsReactionType; emoji: string; label: string }> = [
  { type: "THUMBS_UP", emoji: "👍", label: "J'approuve" },
  { type: "HEART", emoji: "❤️", label: "J'aime" },
  { type: "QUESTION", emoji: "❓", label: "Question" },
]

const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: "INAPPROPRIATE", label: "Contenu inapproprié" },
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harcèlement" },
  { value: "MISINFORMATION", label: "Désinformation" },
  { value: "OTHER", label: "Autre" },
]

export function NewsCommentItem({
  comment,
  isLoggedIn,
}: {
  comment: HydratedComment
  isLoggedIn: boolean
}) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState(comment)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  if (optimistic.status === "DELETED") {
    return (
      <div
        className="text-sm italic px-4 py-3 rounded-xl"
        style={{ background: p.bg2, color: p.ink2, border: `1px solid ${p.line}` }}
      >
        « Commentaire supprimé »
      </div>
    )
  }

  async function toggleReaction(type: NewsReactionType) {
    if (!isLoggedIn) return
    try {
      const res = await fetch(`/api/news/comments/${comment.id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json()
        setOptimistic(data.comment)
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function deleteSelf() {
    if (!confirm("Supprimer ce commentaire ?")) return
    const res = await fetch(`/api/news/comments/${comment.id}`, { method: "DELETE" })
    if (res.ok) {
      setOptimistic({ ...optimistic, status: "DELETED", body: "" })
      startTransition(() => router.refresh())
    }
  }

  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <header className="flex items-start gap-3 mb-2">
        <UserAvatar user={optimistic.user} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: p.ink }}>
              {optimistic.user.name || "Membre"}
            </span>
            <span className="text-xs" style={{ color: p.ink2 }}>
              {formatRelativeTimeFr(optimistic.createdAt)}
              {optimistic.editedAt && " · modifié"}
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:opacity-70"
            aria-label="Menu"
            style={{ color: p.ink2 }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl py-1 text-sm shadow-lg"
              style={{ background: p.card, border: `1px solid ${p.line2}` }}
            >
              {optimistic.canEdit && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:opacity-70 flex items-center gap-2"
                  onClick={() => { setEditing(true); setMenuOpen(false) }}
                  style={{ color: p.ink }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </button>
              )}
              {optimistic.canDelete && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:opacity-70 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); deleteSelf() }}
                  style={{ color: p.accent }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              )}
              {!optimistic.canEdit && isLoggedIn && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:opacity-70 flex items-center gap-2"
                  onClick={() => { setReportOpen(true); setMenuOpen(false) }}
                  style={{ color: p.ink }}
                >
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <CommentEditor
          comment={optimistic}
          onSaved={(c) => { setOptimistic(c); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p
          className="text-sm leading-relaxed mb-3 whitespace-pre-wrap"
          style={{ color: p.ink }}
        >
          {optimistic.body}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {REACTION_BUTTONS.map((r) => {
          const count = optimistic.reactions[r.type]
          const active = optimistic.myReactions.includes(r.type)
          return (
            <button
              key={r.type}
              type="button"
              onClick={() => toggleReaction(r.type)}
              disabled={!isLoggedIn}
              title={isLoggedIn ? r.label : "Connectez-vous pour réagir"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: active ? p.bg2 : "transparent",
                border: `1px solid ${active ? p.accent : p.line}`,
                color: p.ink,
              }}
            >
              <span aria-hidden>{r.emoji}</span>
              {count > 0 && <span style={{ fontWeight: 600 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {reportOpen && (
        <ReportDialog
          commentId={comment.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}

function CommentEditor({
  comment,
  onSaved,
  onCancel,
}: {
  comment: HydratedComment
  onSaved: (c: HydratedComment) => void
  onCancel: () => void
}) {
  const p = APERCU_PALETTE
  const [body, setBody] = useState(comment.body)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/news/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Erreur")
      } else {
        onSaved(data.comment)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1500}
        className="w-full text-sm rounded-lg p-2.5 outline-none"
        style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
      />
      {error && <p className="text-xs mt-1" style={{ color: p.accent }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full"
          style={{ color: p.ink2, border: `1px solid ${p.line}` }}
        >
          <X className="w-3 h-3" /> Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={submitting || body.trim().length === 0}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full disabled:opacity-50"
          style={{ background: p.ink, color: p.bg }}
        >
          <Check className="w-3 h-3" /> Enregistrer
        </button>
      </div>
    </div>
  )
}

function ReportDialog({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const p = APERCU_PALETTE
  const [reason, setReason] = useState(REPORT_REASONS[0].value)
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/news/comments/${commentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? "Erreur")
      } else {
        setDone(true)
        setTimeout(onClose, 1200)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,26,21,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-3" style={{ color: p.ink }}>
          Signaler ce commentaire
        </h3>
        {done ? (
          <p className="text-sm" style={{ color: p.ink2 }}>
            Merci, votre signalement a été enregistré.
          </p>
        ) : (
          <>
            <label className="block text-xs mb-1" style={{ color: p.ink2 }}>
              Raison
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm rounded-lg p-2 mb-3"
              style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <label className="block text-xs mb-1" style={{ color: p.ink2 }}>
              Détails (facultatif)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full text-sm rounded-lg p-2 mb-3"
              style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
            />
            {error && <p className="text-xs mb-2" style={{ color: p.accent }}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ color: p.ink2, border: `1px solid ${p.line}` }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50"
                style={{ background: p.accent, color: "#fff" }}
              >
                Envoyer le signalement
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
