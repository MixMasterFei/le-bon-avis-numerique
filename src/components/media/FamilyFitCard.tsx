"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, LogIn, UserPlus, Check, AlertTriangle, Sparkles, Lightbulb, ShieldAlert, Calendar, Heart } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { cn } from "@/lib/utils"
import {
  type AgeVerdict,
  type AgePillar,
  type PreferenceVerdict,
  type PreferencePillar,
} from "@/lib/family-fit-display"

// ---------------------------------------------------------------------------
// Types
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
  ageVerdict?: AgeVerdict
  preferenceVerdict?: PreferenceVerdict
  hasPreferences?: boolean
  profileComplete?: boolean
  affinity?: AffinityInfo
}

type FamilyFitResponse =
  | { status: "not_logged_in" }
  | { status: "no_family" }
  | { status: "ok"; members: FamilyFitMember[] }
  | { status: "family_warning"; members: FamilyFitMember[] }

interface FamilyFitCardProps {
  mediaId: string
}

// ---------------------------------------------------------------------------
// Level configuration
// ---------------------------------------------------------------------------

// Pillar UI configuration. Each pillar gets its own color + icon so users can
// distinguish AGE (chronological) from PRÉFÉRENCES (taste / tolerance) at a glance.

const AGE_PILLAR_CONFIG: Record<
  AgePillar,
  { pillBg: string; pillText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ok:         { pillBg: "bg-emerald-100", pillText: "text-emerald-700", icon: Check },
  borderline: { pillBg: "bg-amber-100",   pillText: "text-amber-700",   icon: AlertTriangle },
  tooEarly:   { pillBg: "bg-rose-100",    pillText: "text-rose-700",    icon: ShieldAlert },
  tooLate:    { pillBg: "bg-slate-100",   pillText: "text-slate-600",   icon: AlertTriangle },
  unknown:    { pillBg: "bg-slate-100",   pillText: "text-slate-600",   icon: AlertTriangle },
}

const PREFERENCE_PILLAR_CONFIG: Record<
  PreferencePillar,
  { pillBg: string; pillText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  love:      { pillBg: "bg-emerald-100", pillText: "text-emerald-700", icon: Heart },
  good:      { pillBg: "bg-sky-100",     pillText: "text-sky-700",     icon: Check },
  check:     { pillBg: "bg-amber-100",   pillText: "text-amber-700",   icon: AlertTriangle },
  avoid:     { pillBg: "bg-rose-100",    pillText: "text-rose-700",    icon: ShieldAlert },
  noProfile: { pillBg: "bg-slate-100",   pillText: "text-slate-600",   icon: Sparkles },
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-gray-200 animate-pulse" />
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FamilyFitCard({ mediaId }: FamilyFitCardProps) {
  const [data, setData] = useState<FamilyFitResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchFit() {
      try {
        const res = await fetch(`/api/media/${mediaId}/family-fit`)
        if (!res.ok) throw new Error("Erreur reseau")
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        // Silently degrade -- card simply won't show
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
  if (loading) return <Skeleton />

  // ---------- Not logged in ----------
  if (data?.status === "not_logged_in") {
    return (
      <Card className="border-indigo-200 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">
              Ce contenu convient-il à votre famille ?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Créez un profil famille pour découvrir si ce contenu est adapté à
            chaque membre de votre famille. C&apos;est gratuit et prend 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/inscription"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              Créer mon profil
            </Link>
            <Link
              href="/connexion"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Se connecter
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Vous pourrez modifier vos préférences à tout moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ---------- No family members ----------
  if (data?.status === "no_family") {
    return (
      <Card className="border-indigo-200 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">
              Adapté à votre famille ?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Ajoutez les membres de votre famille pour voir si ce contenu leur convient.
          </p>
          <Link
            href="/profil"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un membre
          </Link>
        </CardContent>
      </Card>
    )
  }

  // ---------- No data (fetch error) ----------
  if (!data || (data.status !== "ok" && data.status !== "family_warning")) return null

  // ---------- OK or Family Warning: show members ----------
  const { members } = data
  const isFamilyWarning = data.status === "family_warning"

  return (
    <Card>
      <CardHeader className={cn(
        "pb-3 rounded-t-xl",
        isFamilyWarning
          ? "bg-gradient-to-r from-orange-50 to-red-50"
          : "bg-gradient-to-r from-indigo-50 to-purple-50"
      )}>
        <CardTitle className="text-lg flex items-center gap-2">
          {isFamilyWarning ? (
            <>
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              <span className="text-orange-800">Attention famille</span>
            </>
          ) : (
            <>
              <Users className="h-5 w-5 text-indigo-600" />
              Repères pour ma famille
            </>
          )}
        </CardTitle>
        {isFamilyWarning && (
          <p className="text-sm text-orange-700 mt-1">
            Ce contenu contient des éléments sensibles pour les familles avec enfants.
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {members.map((member) => {
          const ageCfg = AGE_PILLAR_CONFIG[member.ageVerdict?.pillar ?? "unknown"]
          const prefCfg = PREFERENCE_PILLAR_CONFIG[member.preferenceVerdict?.pillar ?? "noProfile"]
          const AgeIcon = ageCfg.icon
          const PrefIcon = prefCfg.icon
          const ageLabel = member.ageVerdict?.label ?? "Âge"
          const prefLabel = member.preferenceVerdict?.label ?? "Profil à compléter"
          const ageDetail = member.ageVerdict?.detail
          const prefReasons = member.preferenceVerdict?.reasons ?? []

          return (
            <div key={member.id} className="space-y-2">
              {/* Top row: avatar + name + age */}
              <div className="flex items-center gap-2 min-w-0">
                <MemberAvatar
                  avatarStyle={member.avatarStyle ?? null}
                  avatarSeed={member.avatarSeed ?? null}
                  avatarOptions={member.avatarOptions ?? null}
                  avatarEmoji={member.avatarEmoji ?? null}
                  name={member.name}
                  size={24}
                />
                <span className="font-semibold text-sm truncate">{member.name}</span>
                {member.age != null && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {member.age} ans
                  </span>
                )}
              </div>

              {/* Two pillars side by side */}
              <div className="grid grid-cols-2 gap-2 pl-8">
                {/* AGE pillar */}
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium w-fit",
                      ageCfg.pillBg,
                      ageCfg.pillText,
                    )}
                  >
                    <Calendar className="h-3 w-3" />
                    <AgeIcon className="h-3.5 w-3.5" />
                    {ageLabel}
                  </span>
                  {ageDetail && (
                    <p className="text-[11px] text-gray-500">{ageDetail}</p>
                  )}
                </div>

                {/* PRÉFÉRENCES pillar */}
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium w-fit",
                      prefCfg.pillBg,
                      prefCfg.pillText,
                    )}
                    title={
                      member.hasPreferences === false
                        ? "Repère limité : faites le quiz famille pour affiner cette recommandation."
                        : undefined
                    }
                  >
                    <PrefIcon className="h-3.5 w-3.5" />
                    {prefLabel}
                  </span>
                  {prefReasons.length > 0 && (
                    <p className="text-[11px] text-gray-500 leading-tight">
                      {prefReasons.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Affinity insight */}
              {member.affinity?.affinityReason && (
                <p className="text-xs text-indigo-600 pl-8 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 flex-shrink-0" />
                  {member.affinity.affinityReason}
                </p>
              )}

              {/* Quiz prompt: empty profiles → do the quiz; partial → finish it */}
              {member.hasPreferences === false ? (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="text-xs text-indigo-500 pl-8 flex items-center gap-1 hover:text-indigo-700 transition-colors"
                >
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  Faire le quiz pour affiner cet indice
                </Link>
              ) : member.profileComplete === false ? (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="text-xs text-gray-400 pl-8 flex items-center gap-1 hover:text-gray-600 transition-colors"
                >
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  Compléter le quiz pour affiner
                </Link>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
