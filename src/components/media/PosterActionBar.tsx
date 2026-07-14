"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Heart, Eye, Bookmark, ThumbsDown, Users, Check, Plus, X } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { posterActionsEnabled } from "@/lib/poster-actions-flag"
import { useFamilyMembers } from "@/hooks/useFamilyMembers"
import { useUserReactions } from "@/hooks/useUserReactions"

const ACTION_KINDS = new Set(["WANTS_TO_WATCH", "WATCHED", "LOVED", "NOT_FOR_ME"])

// Quick per-member triage on any poster, site-wide: "à voir" / "déjà vu" /
// "adoré". One tap captures a real per-member reaction (feeding the taste
// vector) without opening the fiche — the flywheel-at-scroll-speed mechanic.
//
// Reactions are one-per-member-per-title (unique constraint), so the three
// actions are a per-member STATE, not three independent flags: setting one
// replaces the member's prior state (want → watched → adoré). The top-row
// counts reflect how many members are currently in each state.

// Spans the full signal spectrum — intent, seen (dedup), loved (+2.0), and a
// dislike (NOT_FOR_ME, -2.0). The negative is deliberate: it's the strongest
// filtering signal and the one the fast lane would otherwise never capture,
// leaving the taste vector positivity-biased.
type ActionKind = "WANTS_TO_WATCH" | "WATCHED" | "LOVED" | "NOT_FOR_ME"

const ACTIONS: { kind: ActionKind; label: string; Icon: typeof Heart }[] = [
  { kind: "WANTS_TO_WATCH", label: "À voir", Icon: Bookmark },
  { kind: "WATCHED", label: "Déjà vu", Icon: Eye },
  { kind: "LOVED", label: "Adoré", Icon: Heart },
  { kind: "NOT_FOR_ME", label: "Pas pour nous", Icon: ThumbsDown },
]

// Benefit-led copy for the anonymous signup gate — the save-hook the market
// study names as the #1 conversion driver (16× a newsletter form). The prompt
// sells what the account KEEPS, per the tapped action.
const SIGNUP_COPY: Record<ActionKind, string> = {
  WANTS_TO_WATCH: "Gardez votre liste « à voir »",
  WATCHED: "Suivez ce que votre famille a vu",
  LOVED: "Enregistrez vos coups de cœur",
  NOT_FOR_ME: "Écartez ce qui n'est pas pour vous",
}

export function PosterActionBar({ mediaId }: { mediaId: string }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const enabled = posterActionsEnabled()
  const loggedIn = !!session?.user

  // Members + preload only matter for logged-in users; anonymous visitors get
  // the signup gate instead (no fetches).
  const members = useFamilyMembers(enabled && loggedIn)
  const preloaded = useUserReactions(enabled && loggedIn)
  // Optimistic per-member state for THIS media.
  const [state, setState] = useState<Record<string, ActionKind>>({})
  const [openAction, setOpenAction] = useState<ActionKind | null>(null)
  const [signupFor, setSignupFor] = useState<ActionKind | null>(null)
  const [busy, setBusy] = useState(false)
  // Small screens collapse the 4-button row behind a single toggle so it fits
  // narrow posters; desktop keeps the inline row.
  const [mobileOpen, setMobileOpen] = useState(false)
  // Once the user interacts, a late-arriving preload must not clobber their
  // fresh optimistic state.
  const touched = useRef(false)
  // Portals need a client-side DOM target; render nothing server-side.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Lock background scroll while the member-picker sheet is open, and close it
  // on Escape (desktop). Only engages for the multi-member sheet.
  const sheetOpen = openAction !== null && !!members && members.length > 1
  useEffect(() => {
    if (!sheetOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAction(null)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [sheetOpen])

  // Seed from the shared preload when it lands (one fetch for the whole grid).
  useEffect(() => {
    if (!preloaded || touched.current) return
    const forMedia = preloaded[mediaId]
    if (!forMedia) return
    const seed: Record<string, ActionKind> = {}
    for (const [memberId, reaction] of Object.entries(forMedia)) {
      if (ACTION_KINDS.has(reaction)) seed[memberId] = reaction as ActionKind
    }
    if (Object.keys(seed).length > 0) setState(seed)
  }, [preloaded, mediaId])

  const counts = useMemo(() => {
    const c: Record<ActionKind, number> = { WANTS_TO_WATCH: 0, WATCHED: 0, LOVED: 0, NOT_FOR_ME: 0 }
    for (const k of Object.values(state)) c[k] += 1
    return c
  }, [state])

  if (!enabled) return null

  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  async function applyToMember(memberId: string, kind: ActionKind) {
    touched.current = true
    const current = state[memberId]
    const removing = current === kind
    // Optimistic
    setState((prev) => {
      const next = { ...prev }
      if (removing) delete next[memberId]
      else next[memberId] = kind
      return next
    })
    setBusy(true)
    try {
      if (removing) {
        await fetch(`/api/user/reaction?familyMemberId=${memberId}&mediaId=${mediaId}`, {
          method: "DELETE",
        })
      } else {
        await fetch("/api/user/reaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: memberId, mediaId, reaction: kind }),
        })
      }
    } catch {
      // Roll back on failure
      setState((prev) => {
        const next = { ...prev }
        if (removing) next[memberId] = kind
        else delete next[memberId]
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  // "Toute la famille": if everyone already has this state → clear it for all;
  // otherwise set it for everyone who doesn't. Reuses applyToMember (which
  // reads the same state snapshot) so each write is a correct toggle.
  async function applyToAll(kind: ActionKind) {
    if (!members || members.length === 0) return
    const allHave = members.every((m) => state[m.id] === kind)
    await Promise.all(
      members.map((m) => {
        const has = state[m.id] === kind
        if (allHave) return has ? applyToMember(m.id, kind) : Promise.resolve()
        return has ? Promise.resolve() : applyToMember(m.id, kind)
      }),
    )
  }

  function onActionTap(e: React.MouseEvent, kind: ActionKind) {
    stop(e)
    if (!members || members.length === 0) return // handled by the no-member note
    if (members.length === 1) {
      // Single child: skip the picker — one tap = done.
      void applyToMember(members[0].id, kind)
      return
    }
    setOpenAction((prev) => (prev === kind ? null : kind))
  }

  const noMembers = members !== null && members.length === 0
  const totalReactions = Object.keys(state).length

  // One action button — shared by the desktop row and the mobile expanded row.
  function actionButton(kind: ActionKind, label: string, Icon: typeof Heart) {
    const count = counts[kind]
    const on = count > 0
    const open = loggedIn ? openAction === kind : signupFor === kind
    return (
      <button
        key={kind}
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          if (loggedIn) {
            onActionTap(e, kind)
          } else {
            stop(e)
            setSignupFor((prev) => (prev === kind ? null : kind))
          }
        }}
        className="relative inline-flex items-center justify-center rounded-full transition-transform active:scale-90"
        style={{
          width: 30,
          height: 30,
          background: open || on ? "#fff" : "rgba(20,16,12,0.55)",
          color: open || on ? "#1E1A15" : "#fff",
          backdropFilter: "blur(2px)",
        }}
      >
        <Icon className="h-3.5 w-3.5" fill={on && kind === "LOVED" ? "#D16A4A" : "none"} />
        {count > 1 && (
          <span
            className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
            style={{ background: "#D16A4A", color: "#fff" }}
          >
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-30" onClick={stop}>
      {/* Member picker — rendered as a bottom sheet PORTALED to <body> so the
          poster's overflow-hidden can't clip it (the large-family bug). The
          member list scrolls, so it stays clean whatever the family size. */}
      {mounted &&
        openAction &&
        members &&
        members.length > 1 &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
            onClick={(e) => {
              e.stopPropagation()
              setOpenAction(null)
            }}
          >
            {/* Dim backdrop — tap anywhere to dismiss */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl sm:mx-4"
              style={{
                background: "#1B1713",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              {/* Grab handle (mobile affordance) */}
              <div className="flex justify-center pt-2 sm:hidden">
                <div className="h-1 w-9 rounded-full bg-white/25" />
              </div>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 text-white">
                  {(() => {
                    const A = ACTIONS.find((a) => a.kind === openAction)
                    return A ? <A.Icon className="h-4 w-4" /> : null
                  })()}
                  <span className="text-sm font-semibold">
                    {ACTIONS.find((a) => a.kind === openAction)?.label}
                    <span className="text-white/50"> · pour qui ?</span>
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenAction(null)
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Toute la famille — one tap applies (or clears) for everyone */}
              {(() => {
                const allActive = members.every((m) => state[m.id] === openAction)
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void applyToAll(openAction)
                    }}
                    disabled={busy}
                    className="mx-3 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    style={
                      allActive
                        ? { background: "#fff", color: "#1E1A15" }
                        : { background: "rgba(255,255,255,0.08)", color: "#fff" }
                    }
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        background: allActive ? "rgba(30,26,21,0.08)" : "rgba(255,255,255,0.12)",
                      }}
                    >
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-semibold">Toute la famille</span>
                    {allActive && <Check className="h-4 w-4" />}
                  </button>
                )
              })()}

              {/* Member list — scrolls for big families, so nothing overflows */}
              <div className="max-h-[45vh] overflow-y-auto px-3 pb-3">
                {members.map((m) => {
                  const active = state[m.id] === openAction
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void applyToMember(m.id, openAction)
                      }}
                      disabled={busy}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors"
                      style={
                        active
                          ? { background: "#fff", color: "#1E1A15" }
                          : { background: "transparent", color: "#fff" }
                      }
                    >
                      <MemberAvatar
                        avatarStyle={m.avatarStyle ?? null}
                        avatarSeed={m.avatarSeed ?? null}
                        avatarOptions={m.avatarOptions ?? null}
                        avatarEmoji={m.avatarEmoji ?? null}
                        name={m.name}
                        size={34}
                      />
                      <span className="flex-1 text-sm font-medium">{m.name}</span>
                      {active && <Check className="h-4 w-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {noMembers && openAction === null && (
        <div className="mx-2 mb-1 rounded-lg px-2 py-1 text-center text-[10px] text-white" style={{ background: "rgba(20,16,12,0.82)" }}>
          <Link href="/profil" className="underline" onClick={(e) => e.stopPropagation()}>
            Créez un profil famille pour enregistrer
          </Link>
        </div>
      )}

      {/* Anonymous signup gate — the save-hook. The content stays fully
          visible; only the SAVE asks for an account (Google-blessed pattern),
          with benefit-led copy per the tapped action. */}
      {!loggedIn && signupFor && (
        <div className="mx-2 mb-1 rounded-xl p-2.5" style={{ background: "rgba(20,16,12,0.92)" }}>
          <div className="text-[11.5px] font-semibold leading-snug text-white">{SIGNUP_COPY[signupFor]}</div>
          <div className="mt-0.5 text-[10px] leading-snug text-white/70">
            Compte famille gratuit — des repères adaptés à chaque enfant.
          </div>
          <div className="mt-2 flex gap-1.5">
            <Link
              href={`/inscription?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: "#fff", color: "#1E1A15" }}
            >
              S&apos;inscrire
            </Link>
            <Link
              href={`/connexion?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}
            >
              Se connecter
            </Link>
          </div>
        </div>
      )}

      {/* DESKTOP: inline 4-button row. Subtle at rest, brighten on card hover;
          hidden on small screens (they use the collapsed toggle below). */}
      <div className="hidden items-center justify-center gap-1.5 px-2 pb-2 opacity-100 transition-opacity duration-200 sm:flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
        {ACTIONS.map(({ kind, label, Icon }) => actionButton(kind, label, Icon))}
      </div>

      {/* MOBILE: a single toggle that expands the four options — fits narrow
          posters where a 4-button row would overflow. Always visible (touch). */}
      <div className="flex justify-center px-2 pb-2 sm:hidden">
        {!mobileOpen ? (
          <button
            type="button"
            aria-label="Réagir"
            title="Réagir"
            onClick={(e) => {
              stop(e)
              setMobileOpen(true)
            }}
            className="relative inline-flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ width: 30, height: 30, background: totalReactions > 0 ? "#fff" : "rgba(20,16,12,0.62)", color: totalReactions > 0 ? "#1E1A15" : "#fff", backdropFilter: "blur(2px)" }}
          >
            <Plus className="h-4 w-4" />
            {totalReactions > 0 && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: "#D16A4A" }} />
            )}
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {ACTIONS.map(({ kind, label, Icon }) => actionButton(kind, label, Icon))}
            <button
              type="button"
              aria-label="Fermer"
              onClick={(e) => {
                stop(e)
                setMobileOpen(false)
                setOpenAction(null)
                setSignupFor(null)
              }}
              className="inline-flex items-center justify-center rounded-full transition-transform active:scale-90"
              style={{ width: 30, height: 30, background: "rgba(20,16,12,0.62)", color: "#fff", backdropFilter: "blur(2px)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
