"use client"

import { useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { Check, Eye, Loader2, X } from "lucide-react"

/**
 * Per-card "Déjà vu" action shown on the media cards Totem proposes. Lets the
 * parent mark, in a small popup, which family member(s) have already seen a
 * title — recorded as WATCHED reactions. Because Totem's proposals exclude
 * seen titles (see src/lib/totem/tools.ts), marking here directly reduces the
 * "you keep suggesting things we've already watched" noise.
 *
 * Self-hides for anonymous users. Reuses the existing reaction endpoints:
 *   GET    /api/user/reaction?mediaId=…                → members + their reaction
 *   POST   /api/user/reaction {familyMemberId,mediaId,reaction:"WATCHED"}
 *   DELETE /api/user/reaction?familyMemberId=…&mediaId=…
 */

interface MemberRow {
  id: string
  name: string
  avatarEmoji: string | null
  reaction: string | null
}

// Reaction types that already imply "seen" (mirror of SEEN_REACTIONS server-side).
const SEEN_SET = new Set(["WATCHED", "LOVED", "LIKED", "OK", "SCARED", "BORED"])

// Human labels for a richer existing reaction we won't overwrite from here.
const REACTION_LABEL: Record<string, string> = {
  LOVED: "a adoré",
  LIKED: "a bien aimé",
  OK: "bof",
  SCARED: "a eu peur",
  BORED: "s'est ennuyé",
  TOO_YOUNG: "trop jeune",
  TOO_OLD: "trop grand",
  NOT_FOR_ME: "pas pour lui",
}

export function TotemSeenButton({ mediaId, mediaTitle }: { mediaId: string; mediaTitle: string }) {
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/user/reaction?mediaId=${encodeURIComponent(mediaId)}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        setError("Connectez-vous pour suivre qui a vu quoi.")
        setMembers([])
        return
      }
      const data = (await res.json()) as {
        familyMembers?: Array<{
          id: string
          name: string
          avatarEmoji: string | null
          reaction: { reaction: string } | null
        }>
      }
      setMembers(
        (data.familyMembers ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          avatarEmoji: m.avatarEmoji ?? null,
          reaction: m.reaction?.reaction ?? null,
        })),
      )
    } catch {
      setError("Erreur réseau, réessayez.")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [mediaId])

  // Rendered inside a media card (a stretched Link). Kept out of the hook path
  // above so hook order stays stable regardless of auth state.
  if (status !== "authenticated") return null

  const openPopup = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    if (members === null) void load()
  }

  const closePopup = () => setOpen(false)

  const toggle = async (m: MemberRow) => {
    const isSeen = m.reaction != null && SEEN_SET.has(m.reaction)
    // A richer reaction (LOVED, SCARED…) means they've seen it but was set
    // elsewhere — don't let a "déjà vu" toggle delete it.
    if (isSeen && m.reaction !== "WATCHED") return
    setSavingId(m.id)
    setError(null)
    try {
      if (isSeen) {
        const res = await fetch(
          `/api/user/reaction?familyMemberId=${encodeURIComponent(m.id)}&mediaId=${encodeURIComponent(mediaId)}`,
          { method: "DELETE" },
        )
        if (!res.ok) throw new Error()
        setMembers((prev) => prev?.map((x) => (x.id === m.id ? { ...x, reaction: null } : x)) ?? null)
      } else {
        const res = await fetch(`/api/user/reaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: m.id, mediaId, reaction: "WATCHED" }),
        })
        if (!res.ok) throw new Error()
        setMembers((prev) => prev?.map((x) => (x.id === m.id ? { ...x, reaction: "WATCHED" } : x)) ?? null)
      }
    } catch {
      setError("Impossible d'enregistrer, réessayez.")
    } finally {
      setSavingId(null)
    }
  }

  const seenCount = members?.filter((m) => m.reaction != null && SEEN_SET.has(m.reaction)).length ?? 0

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80"
        style={{
          background: "color-mix(in srgb, var(--color-ink2) 12%, transparent)",
          color: "var(--color-ink2)",
        }}
        aria-label={`Marquer « ${mediaTitle} » comme déjà vu`}
      >
        <Eye className="h-3 w-3" />
        Déjà vu{seenCount > 0 ? ` · ${seenCount}` : ""}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={closePopup}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-4 shadow-xl"
              style={{
                background: "var(--color-card)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-line)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-fraunces)" }}>
                    Qui l&apos;a déjà vu ?
                  </div>
                  <div className="mt-0.5 truncate text-[12px]" style={{ color: "var(--color-ink2)" }}>
                    {mediaTitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePopup}
                  aria-label="Fermer"
                  className="rounded-full p-1 transition hover:opacity-70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-0.5">
                {loading && (
                  <div className="flex items-center gap-2 py-3 text-sm" style={{ color: "var(--color-ink2)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                )}

                {!loading && members && members.length === 0 && !error && (
                  <div className="py-2 text-[13px]" style={{ color: "var(--color-ink2)" }}>
                    Ajoutez les membres de votre foyer depuis votre profil pour suivre qui a vu quoi.
                  </div>
                )}

                {!loading &&
                  members?.map((m) => {
                    const isSeen = m.reaction != null && SEEN_SET.has(m.reaction)
                    const locked = isSeen && m.reaction !== "WATCHED"
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={savingId === m.id || locked}
                        onClick={() => toggle(m)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--color-ink2)_8%,transparent)] disabled:cursor-default"
                      >
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border"
                          style={{
                            borderColor: isSeen ? "var(--color-accent)" : "var(--color-line)",
                            background: isSeen ? "var(--color-accent)" : "transparent",
                          }}
                        >
                          {savingId === m.id ? (
                            <Loader2
                              className="h-3 w-3 animate-spin"
                              style={{ color: isSeen ? "#fff" : "var(--color-ink2)" }}
                            />
                          ) : isSeen ? (
                            <Check className="h-3 w-3 text-white" />
                          ) : null}
                        </span>
                        <span className="text-base">{m.avatarEmoji ?? "🙂"}</span>
                        <span className="flex-1 truncate text-sm">{m.name}</span>
                        {locked && (
                          <span className="text-[11px]" style={{ color: "var(--color-ink2)" }}>
                            {REACTION_LABEL[m.reaction as string] ?? "déjà noté"}
                          </span>
                        )}
                      </button>
                    )
                  })}
              </div>

              {error && (
                <div className="mt-2 text-[12px]" style={{ color: "#b91c1c" }}>
                  {error}
                </div>
              )}

              <div className="mt-3 text-[11px]" style={{ color: "var(--color-ink2)" }}>
                Les titres marqués vus ne vous seront plus proposés par Totem.
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
