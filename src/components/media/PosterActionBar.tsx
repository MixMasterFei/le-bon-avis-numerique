"use client"

import { useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Heart, Eye, Bookmark, Check } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { posterActionsEnabled } from "@/lib/poster-actions-flag"
import { useFamilyMembers } from "@/hooks/useFamilyMembers"

// Quick per-member triage on any poster, site-wide: "à voir" / "déjà vu" /
// "adoré". One tap captures a real per-member reaction (feeding the taste
// vector) without opening the fiche — the flywheel-at-scroll-speed mechanic.
//
// Reactions are one-per-member-per-title (unique constraint), so the three
// actions are a per-member STATE, not three independent flags: setting one
// replaces the member's prior state (want → watched → adoré). The top-row
// counts reflect how many members are currently in each state.

type ActionKind = "WANTS_TO_WATCH" | "WATCHED" | "LOVED"

const ACTIONS: { kind: ActionKind; label: string; Icon: typeof Heart }[] = [
  { kind: "WANTS_TO_WATCH", label: "À voir", Icon: Bookmark },
  { kind: "WATCHED", label: "Déjà vu", Icon: Eye },
  { kind: "LOVED", label: "Adoré", Icon: Heart },
]

export function PosterActionBar({ mediaId }: { mediaId: string }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const enabled = !!session?.user && posterActionsEnabled(isAdmin)

  const members = useFamilyMembers(enabled)
  // Optimistic per-member state for THIS media. Not preloaded in v1 (avoids N
  // fetches on a grid) — starts blank and reflects what the user sets in
  // session. Batch-preload is the immediate follow-up.
  const [state, setState] = useState<Record<string, ActionKind>>({})
  const [openAction, setOpenAction] = useState<ActionKind | null>(null)
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => {
    const c: Record<ActionKind, number> = { WANTS_TO_WATCH: 0, WATCHED: 0, LOVED: 0 }
    for (const k of Object.values(state)) c[k] += 1
    return c
  }, [state])

  if (!enabled) return null

  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  async function applyToMember(memberId: string, kind: ActionKind) {
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

  return (
    <div className="absolute inset-x-0 bottom-0 z-30" onClick={stop}>
      {/* member picker — opens above the action row, dark panel for legibility */}
      {openAction && members && members.length > 1 && (
        <div
          className="mx-2 mb-1 rounded-xl p-2 backdrop-blur-sm"
          style={{ background: "rgba(20,16,12,0.82)" }}
        >
          <div className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {ACTIONS.find((a) => a.kind === openAction)?.label} · qui ?
          </div>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const active = state[m.id] === openAction
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    void applyToMember(m.id, openAction)
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-semibold transition-colors"
                  style={
                    active
                      ? { background: "#fff", color: "#1E1A15" }
                      : { background: "rgba(255,255,255,0.14)", color: "#fff" }
                  }
                >
                  <MemberAvatar
                    avatarStyle={m.avatarStyle ?? null}
                    avatarSeed={m.avatarSeed ?? null}
                    avatarOptions={m.avatarOptions ?? null}
                    avatarEmoji={m.avatarEmoji ?? null}
                    name={m.name}
                    size={18}
                  />
                  {m.name}
                  {active && <Check className="h-3 w-3" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {noMembers && openAction === null && (
        <div className="mx-2 mb-1 rounded-lg px-2 py-1 text-center text-[10px] text-white" style={{ background: "rgba(20,16,12,0.82)" }}>
          <Link href="/profil" className="underline" onClick={(e) => e.stopPropagation()}>
            Créez un profil famille pour enregistrer
          </Link>
        </div>
      )}

      {/* action row — subtle at rest, brighten on card hover; always visible on
          touch (no hover). */}
      <div className="flex items-center justify-center gap-1.5 px-2 pb-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {ACTIONS.map(({ kind, label, Icon }) => {
          const count = counts[kind]
          const on = count > 0
          const open = openAction === kind
          return (
            <button
              key={kind}
              type="button"
              aria-label={label}
              title={label}
              onClick={(e) => onActionTap(e, kind)}
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
        })}
      </div>
    </div>
  )
}
