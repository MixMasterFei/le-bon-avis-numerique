"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Bookmark,
  Check,
  Copy,
  Mail,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Loader2,
} from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import { DISLIKE_REASONS, MAX_REASON_NOTE_LENGTH } from "@/lib/news-feedback"

type StoryReaction = "LIKE" | "DISLIKE"

interface EngagementState {
  reactions: Record<StoryReaction, number>
  myReaction: StoryReaction | null
  saved: boolean
  savedAt: string | null
  readAt: string | null
}

const EMPTY_ENGAGEMENT: EngagementState = {
  reactions: { LIKE: 0, DISLIKE: 0 },
  myReaction: null,
  saved: false,
  savedAt: null,
  readAt: null,
}

interface PillButtonProps {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  activeColor?: string
  disabled?: boolean
  title?: string
}

function PillButton({
  children,
  onClick,
  active,
  activeColor,
  disabled,
  title,
}: PillButtonProps) {
  const p = APERCU_PALETTE
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: active ? p.bg2 : p.card,
        color: active ? activeColor || p.ink : p.ink,
        border: `1px solid ${active ? activeColor || p.ink : p.line}`,
      }}
    >
      {children}
    </button>
  )
}

function PillLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const p = APERCU_PALETTE
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-opacity hover:opacity-80"
      style={{
        background: p.card,
        color: p.ink,
        border: `1px solid ${p.line}`,
      }}
    >
      {children}
    </Link>
  )
}

export function NewsStoryActions({
  slug,
  title,
  summary,
}: {
  slug: string
  title: string
  summary: string
}) {
  const p = APERCU_PALETTE
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [engagement, setEngagement] = useState<EngagementState>(EMPTY_ENGAGEMENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reacting, setReacting] = useState<StoryReaction | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Optional "why" after a dislike — same vocabulary as the feed cards.
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reasonSent, setReasonSent] = useState(false)
  const [reasonNote, setReasonNote] = useState("")
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [shareUrl, setShareUrl] = useState(`/apercudecouverte/${slug}`)

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedTitle = encodeURIComponent(title)
  const encodedMailBody = encodeURIComponent(`${summary}\n\n${shareUrl}`)
  const callbackUrl = encodeURIComponent(pathname || `/apercudecouverte/${slug}`)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator)
    setShareUrl(`${window.location.origin}/apercudecouverte/${slug}`)
  }, [slug])

  useEffect(() => {
    let cancelled = false
    async function fetchEngagement() {
      try {
        const res = await fetch(`/api/news/${encodeURIComponent(slug)}/engagement`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setEngagement({ ...EMPTY_ENGAGEMENT, ...data })
      } catch (error) {
        console.error("Failed to fetch news engagement:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchEngagement()
    return () => {
      cancelled = true
    }
  }, [slug])

  const postEngagement = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/news/${encodeURIComponent(slug)}/engagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Engagement update failed")
      const data = await res.json()
      setEngagement({ ...EMPTY_ENGAGEMENT, ...data })
    },
    [slug],
  )

  async function toggleReaction(type: StoryReaction) {
    if (!session?.user) return
    setReacting(type)
    // Opening a DISLIKE (was something else) offers the optional "why" —
    // same reason flow as the feed cards, feeding the reader signals.
    const willDislike = type === "DISLIKE" && engagement.myReaction !== "DISLIKE"
    try {
      await postEngagement({ action: "reaction", type })
      setReasonOpen(willDislike)
      if (willDislike) setReasonSent(false)
    } catch (error) {
      console.error(error)
    } finally {
      setReacting(null)
    }
  }

  async function sendDislikeReason(code: string) {
    setReasonSent(true)
    setReasonOpen(false)
    try {
      await postEngagement({
        action: "reaction",
        type: "DISLIKE",
        reasonCode: code,
        reasonNote: reasonNote.trim() || undefined,
      })
    } catch (error) {
      console.error(error)
    }
  }

  async function toggleSaved() {
    if (!session?.user) return
    setSaving(true)
    try {
      await postEngagement({ action: "save", saved: !engagement.saved })
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function nativeShare() {
    if (!navigator.share) return
    try {
      await navigator.share({ title, text: summary, url: shareUrl })
      setShareOpen(false)
    } catch {
      // User cancelled the native sheet.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked in non-secure contexts.
    }
  }

  const reactionButtons = session?.user ? (
    <>
      <PillButton
        onClick={() => toggleReaction("LIKE")}
        disabled={reacting !== null}
        active={engagement.myReaction === "LIKE"}
        activeColor="#5C8A5C"
        title="Utile"
      >
        {reacting === "LIKE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
        <span>Utile</span>
        {engagement.reactions.LIKE > 0 && <span>{engagement.reactions.LIKE}</span>}
      </PillButton>
      <PillButton
        onClick={() => toggleReaction("DISLIKE")}
        disabled={reacting !== null}
        active={engagement.myReaction === "DISLIKE"}
        activeColor={p.accent}
        title="Pas pour nous"
      >
        {reacting === "DISLIKE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
        <span>Pas pour nous</span>
        {engagement.reactions.DISLIKE > 0 && <span>{engagement.reactions.DISLIKE}</span>}
      </PillButton>
    </>
  ) : (
    <>
      <PillLink href={`/connexion?callbackUrl=${callbackUrl}`}>
        <ThumbsUp className="h-4 w-4" />
        <span>Utile</span>
        {engagement.reactions.LIKE > 0 && <span>{engagement.reactions.LIKE}</span>}
      </PillLink>
      <PillLink href={`/connexion?callbackUrl=${callbackUrl}`}>
        <ThumbsDown className="h-4 w-4" />
        <span>Pas pour nous</span>
        {engagement.reactions.DISLIKE > 0 && <span>{engagement.reactions.DISLIKE}</span>}
      </PillLink>
    </>
  )

  if (loading || status === "loading") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2].map((i) => (
          <PillButton key={i} disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </PillButton>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Optional dislike reason — fully skippable, the dislike is already
          recorded. Feeds the reader-signals loop like the feed cards. */}
      {reasonOpen && engagement.myReaction === "DISLIKE" && (
        <div className="rounded-xl p-3" style={{ background: p.bg2, border: `1px solid ${p.line}` }}>
          <div className="mb-2 text-xs font-semibold" style={{ color: p.ink2 }}>
            Pourquoi&nbsp;? (facultatif — ça nous aide à mieux choisir les actus)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DISLIKE_REASONS).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => sendDislikeReason(code)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ background: p.card, color: p.ink, border: `1px solid ${p.line}` }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            maxLength={MAX_REASON_NOTE_LENGTH}
            placeholder="Précisez si vous voulez…"
            className="mt-2 w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
            style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && reasonNote.trim()) sendDislikeReason("autre")
            }}
          />
          <button
            type="button"
            onClick={() => setReasonOpen(false)}
            className="mt-1.5 text-[11px] underline underline-offset-2 opacity-60 hover:opacity-100"
            style={{ color: p.ink2 }}
          >
            Passer
          </button>
        </div>
      )}
      {reasonSent && (
        <div className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#5C8A5C" }}>
          <Check className="h-3.5 w-3.5" /> Merci, c&apos;est noté&nbsp;!
        </div>
      )}

    <div className="flex flex-wrap items-center gap-2">
      {reactionButtons}

      {session?.user ? (
        <PillButton
          onClick={toggleSaved}
          disabled={saving}
          active={engagement.saved}
          activeColor="#5C8A5C"
          title={engagement.saved ? "Retirer de la lecture plus tard" : "Lire plus tard"}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bookmark
              className="h-4 w-4"
              style={{ fill: engagement.saved ? "#5C8A5C" : "transparent" }}
            />
          )}
          <span>{engagement.saved ? "Dans ma liste" : "Lire plus tard"}</span>
        </PillButton>
      ) : (
        <PillLink href={`/connexion?callbackUrl=${callbackUrl}`}>
          <Bookmark className="h-4 w-4" />
          <span>Lire plus tard</span>
        </PillLink>
      )}

      <div className="relative">
        <PillButton onClick={() => setShareOpen((value) => !value)} active={shareOpen}>
          <Share2 className="h-4 w-4" />
          <span>Partager</span>
        </PillButton>
        {shareOpen && (
          <div
            className="absolute right-0 z-30 mt-2 min-w-[210px] rounded-2xl p-1.5 text-sm shadow-lg"
            style={{ background: p.card, border: `1px solid ${p.line2}`, color: p.ink }}
          >
            {canNativeShare && (
              <button
                type="button"
                onClick={nativeShare}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:opacity-70"
              >
                <Share2 className="h-4 w-4" />
                Partage du telephone
              </button>
            )}
            <a
              href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:opacity-70"
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodedTitle}&body=${encodedMailBody}`}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:opacity-70"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:opacity-70"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Lien copie" : "Copier le lien"}
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
