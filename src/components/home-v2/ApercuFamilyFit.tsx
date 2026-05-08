"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Check, AlertTriangle, Sparkles, Lightbulb, ShieldAlert, LogIn, UserPlus } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { FAMILY_FIT_LABELS, familyFitBandFromLevel, type FamilyFitBand } from "@/lib/family-fit-display"

/**
 * Warm-palette variant of FamilyFitCard. Same API (fetches from
 * /api/media/[id]/family-fit), same states, but dressed in the
 * apercu art direction: cream canvas, terracotta italic title,
 * sage/amber/terracotta verdict dots, Fraunces accents.
 *
 * Use this on /apercu* pages instead of FamilyFitCard so the
 * widget belongs to the warm canvas around it.
 */

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

const BAND_CONFIG: Record<
  FamilyFitBand,
  { label: string; dot: string; pillBg: string; pillText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  veryAdapted: {
    label: FAMILY_FIT_LABELS.veryAdapted,
    dot: "#5C8A5C",
    pillBg: "rgba(92,138,92,0.12)",
    pillText: "#3E6040",
    icon: Check,
  },
  goodChoice: {
    label: FAMILY_FIT_LABELS.goodChoice,
    dot: "#3E7E9C",
    pillBg: "rgba(62,126,156,0.12)",
    pillText: "#2F667E",
    icon: Check,
  },
  check: {
    label: FAMILY_FIT_LABELS.check,
    dot: "#D89A4A",
    pillBg: "rgba(216,154,74,0.14)",
    pillText: "#8A5A1E",
    icon: AlertTriangle,
  },
}

function Shell({
  eyebrow,
  title,
  titleAccent,
  children,
  serifClass,
}: {
  eyebrow: string
  title: string
  titleAccent?: string
  children: React.ReactNode
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.08)",
      }}
    >
      <div className="p-5" style={{ borderBottom: `1px solid ${p.line}` }}>
        <div
          className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: p.accent }}
        >
          {eyebrow}
        </div>
        <div
          className={`${serifClass} text-lg font-medium leading-tight`}
          style={{ letterSpacing: "-0.01em", color: p.ink }}
        >
          {title}
          {titleAccent && (
            <em className="italic" style={{ color: p.accent }}>
              {" "}
              {titleAccent}
            </em>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Skeleton({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <Shell eyebrow="Analyse famille" title="Adapté à" titleAccent="ma famille ?" serifClass={serifClass}>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full animate-pulse"
                style={{ background: p.placeholder }}
              />
              <div
                className="h-4 w-24 rounded animate-pulse"
                style={{ background: p.placeholder }}
              />
            </div>
            <div
              className="h-5 w-16 rounded-full animate-pulse"
              style={{ background: p.placeholder }}
            />
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function ApercuFamilyFit({
  mediaId,
  serifClass,
}: {
  mediaId: string
  serifClass: string
}) {
  const [data, setData] = useState<FamilyFitResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const p = APERCU_PALETTE

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

  if (loading) return <Skeleton serifClass={serifClass} />

  if (data?.status === "not_logged_in") {
    return (
      <Shell
        eyebrow="Analyse famille"
        title="Adapté à"
        titleAccent="votre famille ?"
        serifClass={serifClass}
      >
        <p className="text-sm leading-relaxed mb-4" style={{ color: p.ink2 }}>
          Créez un profil famille pour voir si ce contenu convient à chaque
          membre. Gratuit, deux minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full transition-transform hover:scale-[1.02]"
            style={{ background: p.accent, color: "#fff" }}
          >
            <UserPlus className="h-4 w-4" />
            Créer ma famille
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-colors"
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
      </Shell>
    )
  }

  if (data?.status === "no_family") {
    return (
      <Shell
        eyebrow="Analyse famille"
        title="Qui est"
        titleAccent="dans votre famille ?"
        serifClass={serifClass}
      >
        <p className="text-sm leading-relaxed mb-4" style={{ color: p.ink2 }}>
          Ajoutez les membres de votre famille pour voir l’analyse adaptée à
          chaque âge et sensibilité.
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full transition-transform hover:scale-[1.02]"
          style={{ background: p.accent, color: "#fff" }}
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un membre
        </Link>
      </Shell>
    )
  }

  if (!data || (data.status !== "ok" && data.status !== "family_warning")) {
    return null
  }

  const { members } = data
  const isFamilyWarning = data.status === "family_warning"

  return (
    <Shell
      eyebrow={isFamilyWarning ? "Attention famille" : "Analyse famille"}
      title={isFamilyWarning ? "Attention" : "Adapté à"}
      titleAccent={isFamilyWarning ? "famille" : "chaque membre"}
      serifClass={serifClass}
    >
      {isFamilyWarning && (
        <div
          className="mb-4 flex items-start gap-2 p-3 rounded-xl text-xs"
          style={{
            background: "rgba(209,106,74,0.08)",
            color: "#8A3E28",
          }}
        >
          <ShieldAlert
            className="h-4 w-4 flex-shrink-0 mt-0.5"
            style={{ color: p.accent }}
          />
          <span>
            Ce contenu contient des éléments sensibles pour les foyers avec
            enfants.
          </span>
        </div>
      )}

      <div className="space-y-3.5">
        {members.map((member) => {
          const config = BAND_CONFIG[familyFitBandFromLevel(member.level)]
          const Icon = config.icon

          return (
            <div key={member.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MemberAvatar
                    avatarStyle={member.avatarStyle ?? null}
                    avatarSeed={member.avatarSeed ?? null}
                    avatarOptions={member.avatarOptions ?? null}
                    avatarEmoji={member.avatarEmoji ?? null}
                    name={member.name}
                    size={28}
                  />
                  <div className="min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: p.ink }}
                    >
                      {member.name}
                    </div>
                    {member.age != null && (
                      <div className="text-[11px]" style={{ color: p.ink2 }}>
                        {member.age} ans
                      </div>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  )}
                  style={{ background: config.pillBg, color: config.pillText }}
                  title={
                    member.hasPreferences === false
                      ? "Repère limité : faites le quiz famille pour affiner cette recommandation."
                      : undefined
                  }
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
              </div>

              <p
                className="text-[12px] pl-10 leading-snug"
                style={{ color: p.ink2 }}
              >
                {member.reason}
              </p>

              {member.affinity?.affinityReason && (
                <div
                  className="pl-10 flex items-start gap-1.5 text-[12px]"
                  style={{ color: p.accent2 }}
                >
                  <Lightbulb className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{member.affinity.affinityReason}</span>
                </div>
              )}

              {member.hasPreferences === false && (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="pl-10 flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
                  style={{ color: p.accent }}
                >
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  Faire le quiz pour personnaliser
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </Shell>
  )
}
