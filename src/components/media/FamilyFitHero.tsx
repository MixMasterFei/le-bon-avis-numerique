"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, LogIn, UserPlus, Check, AlertTriangle, X as XIcon, Sparkles, Lightbulb, ShieldAlert } from "lucide-react"
import { FamilyWarningVoteButton } from "@/components/media/FamilyWarningVoteButton"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"
const AMBER = "#C08A3E"

// ---------------------------------------------------------------------------
// Types (shared with FamilyFitCard)
// ---------------------------------------------------------------------------

interface AffinityInfo {
  hasConnection: boolean
  connectedMedia?: { title: string; reaction: string }
  affinityReason?: string
  genreAffinityScore?: number
}

interface FamilyFitMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  age: number | null
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
  reason: string
  hasPreferences?: boolean
  affinity?: AffinityInfo
}

type FamilyFitResponse =
  | { status: "not_logged_in" }
  | { status: "no_family" }
  | { status: "ok"; members: FamilyFitMember[] }
  | { status: "family_warning"; members: FamilyFitMember[] }

interface FamilyFitHeroProps {
  mediaId: string
}

// ---------------------------------------------------------------------------
// Level configuration (dark-theme variants)
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<
  FamilyFitMember["level"],
  { label: string; pillBg: string; pillText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  excellent: {
    label: "Excellent",
    pillBg: "rgba(92, 138, 92, 0.14)",
    pillText: SAGE,
    icon: Check,
  },
  good: {
    label: "Bon",
    pillBg: "rgba(92, 138, 92, 0.10)",
    pillText: SAGE,
    icon: Check,
  },
  moderate: {
    label: "Modéré",
    pillBg: "rgba(192, 138, 62, 0.14)",
    pillText: AMBER,
    icon: AlertTriangle,
  },
  poor: {
    label: "Attention",
    pillBg: "rgba(209, 106, 74, 0.14)",
    pillText: "#D16A4A",
    icon: XIcon,
  },
}

// ---------------------------------------------------------------------------
// Skeleton (dark variant)
// ---------------------------------------------------------------------------

function HeroSkeleton() {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="h-5 w-5 rounded animate-pulse"
          style={{ background: p.bg2 }}
        />
        <div
          className="h-5 w-36 rounded animate-pulse"
          style={{ background: p.bg2 }}
        />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full animate-pulse"
                style={{ background: p.bg2 }}
              />
              <div
                className="h-4 w-20 rounded animate-pulse"
                style={{ background: p.bg2 }}
              />
            </div>
            <div
              className="h-6 w-16 rounded-full animate-pulse"
              style={{ background: p.bg2 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FamilyFitHero({ mediaId }: FamilyFitHeroProps) {
  const [data, setData] = useState<FamilyFitResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchFit() {
      try {
        const res = await fetch(`/api/media/${mediaId}/family-fit`)
        if (!res.ok) throw new Error("Erreur réseau")
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFit()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  // ---------- Loading ----------
  if (loading) return <HeroSkeleton />

  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const shellStyle = {
    background: p.card,
    border: `1px solid ${p.line}`,
  }

  // ---------- Not logged in ----------
  if (data?.status === "not_logged_in") {
    return (
      <div className="rounded-2xl p-5" style={shellStyle}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ background: p.bg2, color: p.accent }}
          >
            <Users className="h-4 w-4" />
          </div>
          <h3
            className={`${serifClass} text-base font-medium`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Adapté à votre foyer ?
          </h3>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: p.ink2 }}>
          Créez un profil famille pour découvrir si ce contenu convient à
          chaque membre de votre foyer.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            <UserPlus className="h-4 w-4" />
            Créer mon profil
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
        </div>
        <p className="text-xs mt-3" style={{ color: p.ink2 }}>
          Gratuit — 2 minutes. Modifiable à tout moment.
        </p>
      </div>
    )
  }

  // ---------- No family members ----------
  if (data?.status === "no_family") {
    return (
      <div className="rounded-2xl p-5" style={shellStyle}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ background: p.bg2, color: p.accent }}
          >
            <Users className="h-4 w-4" />
          </div>
          <h3
            className={`${serifClass} text-base font-medium`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Adapté à votre foyer ?
          </h3>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: p.ink2 }}>
          Ajoutez les membres de votre foyer pour voir si ce contenu leur
          convient.
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-opacity hover:opacity-90"
          style={{ background: p.ink, color: p.bg }}
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un membre
        </Link>
      </div>
    )
  }

  // ---------- No data (fetch error) ----------
  if (!data || (data.status !== "ok" && data.status !== "family_warning")) return null

  // ---------- OK or Family Warning: show members ----------
  const { members } = data
  const isFamilyWarning = data.status === "family_warning"

  return (
    <div className="rounded-2xl p-5" style={shellStyle}>
      <h3
        className={`${serifClass} text-base font-medium flex items-center gap-2 mb-2`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        {isFamilyWarning ? (
          <>
            <ShieldAlert className="h-5 w-5" style={{ color: p.accent }} />
            <span style={{ color: p.accent }}>Attention famille</span>
          </>
        ) : (
          <>
            <Users className="h-5 w-5" style={{ color: p.accent }} />
            Adapté à ma famille ?
          </>
        )}
      </h3>
      {isFamilyWarning && (
        <p className="text-sm mb-3" style={{ color: p.accent }}>
          Ce contenu contient des éléments sensibles pour les familles avec
          enfants.
        </p>
      )}

      {/* Community warning vote button */}
      <div className="mb-4">
        <FamilyWarningVoteButton mediaId={mediaId} />
      </div>
      <div className="space-y-3">
        {members.map((member) => {
          const config = LEVEL_CONFIG[member.level]
          const Icon = config.icon

          return (
            <div key={member.id} className="space-y-1">
              {/* Top row: avatar + name + age  |  score pill */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <MemberAvatar
                    avatarStyle={member.avatarStyle ?? null}
                    avatarSeed={member.avatarSeed ?? null}
                    avatarOptions={member.avatarOptions ?? null}
                    avatarEmoji={member.avatarEmoji ?? null}
                    name={member.name}
                    size={20}
                  />
                  <span
                    className="font-medium text-sm truncate"
                    style={{ color: p.ink }}
                  >
                    {member.name}
                  </span>
                  {member.age != null && (
                    <span
                      className="text-xs flex-shrink-0"
                      style={{ color: p.ink2 }}
                    >
                      {member.age} ans
                    </span>
                  )}
                </div>

                {/* Score pill */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0"
                  )}
                  style={{
                    background: config.pillBg,
                    color: config.pillText,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                </span>
              </div>

              {/* Reason */}
              <p className="text-xs pl-7" style={{ color: p.ink2 }}>
                {member.reason}
              </p>

              {/* Affinity insight */}
              {member.affinity?.affinityReason && (
                <p
                  className="text-xs pl-7 flex items-center gap-1"
                  style={{ color: p.accent2 }}
                >
                  <Lightbulb className="h-3 w-3 flex-shrink-0" />
                  {member.affinity.affinityReason}
                </p>
              )}

              {/* Quiz prompt for members without preferences */}
              {member.hasPreferences === false && (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="text-xs pl-7 flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: p.accent }}
                >
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  Faire le quiz pour des recommandations personnalisées
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
