"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { getMemberAge } from "@/lib/age-utils"
import {
  Users,
  Eye,
  Heart,
  ThumbsUp,
  Meh,
  Ghost,
  Frown,
  Baby,
  UserX,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { seenLabelFr } from "@/lib/reaction-types"

interface FamilyMemberWithReaction {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  reaction: {
    id: string
    reaction: string
    note: string | null
  } | null
}

interface FamilyReactionsProps {
  mediaId: string
  mediaTitle: string
  /** Drives the "seen" verb: a game is played, a book is read, not "vu".
   *  Defaults to film/TV wording when unset. */
  mediaType?: string
  /** Render bare — no own card, heading or collapse, always expanded — for
   *  embedding inside another collapsible section (the V3 dashboard) so the
   *  expand control isn't duplicated. */
  embedded?: boolean
}

/** Per-type wording for "seen it" — a game is *joué*, a book *lu*, everything
 *  else *vu*. Shared with DashboardFamilyFeedback so the section header and the
 *  WATCHED reaction label always agree. Label text comes from the shared
 *  reaction vocabulary (src/lib/reaction-types.ts). */
export function seenVerb(mediaType?: string): { label: string; header: string } {
  const label = seenLabelFr(mediaType)
  switch (mediaType) {
    case "GAME":
      return { label, header: "Vous y avez joué ?" }
    case "BOOK":
    case "MANGA":
      return { label, header: "Vous l'avez lu ?" }
    default:
      return { label, header: "Vous l'avez vu ?" }
  }
}

const REACTIONS: {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  selectedBg: string
  ringColor: string
}[] = [
  { value: "WATCHED", label: "Déjà vu", icon: Eye, color: "text-indigo-500 dark:text-indigo-300", bgColor: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-400/10 dark:hover:bg-indigo-400/20", selectedBg: "bg-indigo-100 dark:bg-indigo-400/25", ringColor: "ring-indigo-400" },
  { value: "LOVED", label: "Adoré", icon: Heart, color: "text-red-500 dark:text-red-300", bgColor: "bg-red-50 hover:bg-red-100 dark:bg-red-400/10 dark:hover:bg-red-400/20", selectedBg: "bg-red-100 dark:bg-red-400/25", ringColor: "ring-red-400" },
  { value: "LIKED", label: "Bien aimé", icon: ThumbsUp, color: "text-green-500 dark:text-green-300", bgColor: "bg-green-50 hover:bg-green-100 dark:bg-green-400/10 dark:hover:bg-green-400/20", selectedBg: "bg-green-100 dark:bg-green-400/25", ringColor: "ring-green-400" },
  { value: "OK", label: "Bof", icon: Meh, color: "text-yellow-500 dark:text-yellow-300", bgColor: "bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-400/10 dark:hover:bg-yellow-400/20", selectedBg: "bg-yellow-100 dark:bg-yellow-400/25", ringColor: "ring-yellow-400" },
  { value: "SCARED", label: "A eu peur", icon: Ghost, color: "text-purple-500 dark:text-purple-300", bgColor: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-400/10 dark:hover:bg-purple-400/20", selectedBg: "bg-purple-100 dark:bg-purple-400/25", ringColor: "ring-purple-400" },
  { value: "BORED", label: "S'est ennuyé", icon: Frown, color: "text-gray-500 dark:text-gray-300", bgColor: "bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10", selectedBg: "bg-gray-200 dark:bg-white/20", ringColor: "ring-gray-400" },
  { value: "TOO_YOUNG", label: "Trop jeune", icon: Baby, color: "text-blue-500 dark:text-blue-300", bgColor: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-400/10 dark:hover:bg-blue-400/20", selectedBg: "bg-blue-100 dark:bg-blue-400/25", ringColor: "ring-blue-400" },
  { value: "TOO_OLD", label: "Pas intéressé", icon: UserX, color: "text-orange-500 dark:text-orange-300", bgColor: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-400/10 dark:hover:bg-orange-400/20", selectedBg: "bg-orange-100 dark:bg-orange-400/25", ringColor: "ring-orange-400" },
]

export function FamilyReactions({ mediaId, mediaType, embedded = false }: FamilyReactionsProps) {
  // Override the WATCHED label per media type ("Déjà joué" for games etc.).
  const seenLabel = seenVerb(mediaType).label
  const labelFor = (value: string, fallback?: string) => (value === "WATCHED" ? seenLabel : fallback ?? "")
  // Past-tense "a déjà …" phrasing for the single-choice hint, per media type.
  const seenPastPhrase =
    mediaType === "GAME"
      ? "y a déjà joué"
      : mediaType === "BOOK" || mediaType === "MANGA"
        ? "l'a déjà lu"
        : "l'a déjà vu"
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [members, setMembers] = useState<FamilyMemberWithReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/reaction?mediaId=${mediaId}`)
      if (!res.ok) throw new Error("Erreur")
      const data = await res.json()
      queueMicrotask(() => setMembers(data.familyMembers))
    } catch {
      queueMicrotask(() => setError("Erreur lors du chargement"))
    } finally {
      queueMicrotask(() => setLoading(false))
    }
  }, [mediaId])

  useEffect(() => {
    if (session?.user) {
      fetchReactions()
    } else {
      queueMicrotask(() => setLoading(false))
    }
  }, [session?.user?.id, mediaId, fetchReactions, session?.user])

  const handleReaction = async (memberId: string, reactionValue: string) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return

    // If clicking same reaction, remove it
    if (member.reaction?.reaction === reactionValue) {
      setSaving(memberId)
      // Optimistic update - remove reaction immediately
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, reaction: null } : m
      ))
      try {
        const res = await fetch(`/api/user/reaction?familyMemberId=${memberId}&mediaId=${mediaId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Delete failed")
      } catch {
        setError("Erreur lors de la suppression")
        await fetchReactions() // Revert on error
      } finally {
        setSaving(null)
      }
      return
    }

    // Save new reaction
    setSaving(memberId)
    // Optimistic update - show reaction immediately
    setMembers(prev => prev.map(m =>
      m.id === memberId
        ? { ...m, reaction: { id: "temp", reaction: reactionValue, note: null } }
        : m
    ))
    try {
      const res = await fetch("/api/user/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberId: memberId,
          mediaId,
          reaction: reactionValue,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      // Fetch to get the real ID
      await fetchReactions()
    } catch {
      setError("Erreur lors de l'enregistrement")
      await fetchReactions() // Revert on error
    } finally {
      setSaving(null)
    }
  }

  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  const Shell = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <>{children}</>
    ) : (
      <div className="rounded-2xl p-5" style={{ background: p.card, border: `1px solid ${p.line}` }}>
        {children}
      </div>
    )

  const SectionHeading = () =>
    embedded ? null : (
      <h3
        className={`${serifClass} text-lg font-medium flex items-center gap-2 mb-3`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        <Users className="h-5 w-5" style={{ color: p.accent }} />
        Réactions de la famille
      </h3>
    )

  // Not logged in
  if (status === "unauthenticated") {
    return (
      <Shell>
        <SectionHeading />
        <p className="text-sm mb-3" style={{ color: p.ink2 }}>
          Connectez-vous pour enregistrer les réactions de votre famille à ce
          contenu.
        </p>
        <Link
          href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: p.ink, color: p.bg }}
        >
          Se connecter
        </Link>
      </Shell>
    )
  }

  // Loading
  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-2">
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: p.accent }}
          />
        </div>
      </Shell>
    )
  }

  // No family members
  if (members.length === 0) {
    return (
      <Shell>
        <SectionHeading />
        <p className="text-sm mb-3" style={{ color: p.ink2 }}>
          Ajoutez les membres de votre famille pour enregistrer leurs
          réactions.
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "transparent",
            color: p.ink,
            border: `1px solid ${p.line2}`,
          }}
        >
          <Plus className="h-4 w-4" />
          Ajouter un membre
        </Link>
      </Shell>
    )
  }

  // Show reactions with members who have reacted
  const membersWithReactions = members.filter((m) => m.reaction)
  return (
    <Shell>
      {!embedded && (
        <div className="flex items-center justify-between mb-3">
          <h3
            className={`${serifClass} text-lg font-medium flex items-center gap-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            <Users className="h-5 w-5" style={{ color: p.accent }} />
            Réactions de la famille
          </h3>
          {members.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-opacity hover:opacity-70"
              style={{ color: p.ink2 }}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Réduire
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Ajouter
                </>
              )}
            </button>
          )}
        </div>
      )}
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Show existing reactions (redundant in embedded — the full grid below
            already shows selected states). */}
        {!embedded && membersWithReactions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {membersWithReactions.map((member) => {
              const reactionInfo = REACTIONS.find((r) => r.value === member.reaction?.reaction)
              const Icon = reactionInfo?.icon || Heart
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${reactionInfo?.bgColor || "bg-gray-50 dark:bg-white/5"}`}
                >
                  <MemberAvatar
                    avatarStyle={member.avatarStyle ?? null}
                    avatarSeed={member.avatarSeed ?? null}
                    avatarOptions={(member.avatarOptions as Record<string, unknown>) ?? null}
                    avatarEmoji={member.avatarEmoji ?? null}
                    name={member.name}
                    size={20}
                  />
                  <span className="text-sm font-medium">{member.name}</span>
                  <Icon className={`h-4 w-4 ${reactionInfo?.color || "text-gray-400"}`} />
                  <span className="text-xs text-gray-500">
                    {labelFor(reactionInfo?.value ?? "", reactionInfo?.label)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Expanded view to add reactions (always shown when embedded) */}
        {(expanded || embedded) && (
          <div className={embedded ? "space-y-4" : "space-y-4 pt-2 border-t"}>
            {/* Single-choice hint: reactions are one-per-person, and the
                emotion options already imply the person experienced it — so
                there's no separate "seen" to also tick. */}
            <p className="text-xs leading-snug" style={{ color: p.ink2 }}>
              Une seule réaction par personne — «&nbsp;{labelFor("LOVED", "Adoré")}&nbsp;» ou
              «&nbsp;{labelFor("LIKED", "Bien aimé")}&nbsp;» veut déjà dire que la personne {seenPastPhrase}.
            </p>
            {members.map((member) => (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <MemberAvatar
                    avatarStyle={member.avatarStyle ?? null}
                    avatarSeed={member.avatarSeed ?? null}
                    avatarOptions={(member.avatarOptions as Record<string, unknown>) ?? null}
                    avatarEmoji={member.avatarEmoji ?? null}
                    name={member.name}
                    size={20}
                  />
                  <span className="font-medium text-sm">{member.name}</span>
                  {member.birthYear && (
                    <span className="text-xs text-gray-400">
                      ({getMemberAge(member.birthYear, member.birthMonth)} ans)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REACTIONS.map((reaction) => {
                    const Icon = reaction.icon
                    const isSelected = member.reaction?.reaction === reaction.value
                    const isLoading = saving === member.id

                    return (
                      <button
                        key={reaction.value}
                        onClick={() => handleReaction(member.id, reaction.value)}
                        disabled={isLoading}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-all ${
                          isSelected
                            ? `${reaction.selectedBg} ring-2 ring-offset-1 dark:ring-offset-transparent ${reaction.ringColor}`
                            : "bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]"
                        } ${isLoading ? "opacity-50" : ""}`}
                      >
                        {isLoading && saving === member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className={`h-3.5 w-3.5 ${isSelected ? reaction.color : "text-gray-400"}`} />
                        )}
                        <span className={isSelected ? `font-medium ${reaction.color}` : ""}>
                          {labelFor(reaction.value, reaction.label)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show prompt if no reactions yet */}
        {!embedded && membersWithReactions.length === 0 && !expanded && (
          <p className="text-sm" style={{ color: p.ink2 }}>
            Cliquez sur &quot;Ajouter&quot; pour noter comment vos enfants ont
            réagi à ce contenu.
          </p>
        )}
      </div>
    </Shell>
  )
}
