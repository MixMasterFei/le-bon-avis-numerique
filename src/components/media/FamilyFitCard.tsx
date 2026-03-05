"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, LogIn, UserPlus, Check, AlertTriangle, X as XIcon, Sparkles, Lightbulb, ShieldAlert } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { cn } from "@/lib/utils"

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

interface FamilyFitCardProps {
  mediaId: string
}

// ---------------------------------------------------------------------------
// Level configuration
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<
  FamilyFitMember["level"],
  { label: string; pillBg: string; pillText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  excellent: {
    label: "Excellent",
    pillBg: "bg-green-100",
    pillText: "text-green-700",
    icon: Check,
  },
  good: {
    label: "Bon",
    pillBg: "bg-blue-100",
    pillText: "text-blue-700",
    icon: Check,
  },
  moderate: {
    label: "Modéré",
    pillBg: "bg-amber-100",
    pillText: "text-amber-700",
    icon: AlertTriangle,
  },
  poor: {
    label: "Attention",
    pillBg: "bg-red-100",
    pillText: "text-red-700",
    icon: XIcon,
  },
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
              Ce contenu convient-il à votre foyer ?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Créez un profil famille pour découvrir si ce contenu est adapté à
            chaque membre de votre foyer. C&apos;est gratuit et prend 2 minutes.
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
              Adapté à votre foyer ?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Ajoutez les membres de votre foyer pour voir si ce contenu leur convient.
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
              Adapté à ma famille ?
            </>
          )}
        </CardTitle>
        {isFamilyWarning && (
          <p className="text-sm text-orange-700 mt-1">
            Ce contenu contient des éléments sensibles pour les familles avec enfants.
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {members.map((member) => {
          const config = LEVEL_CONFIG[member.level]
          const Icon = config.icon

          return (
            <div key={member.id} className="space-y-1">
              {/* Top row: avatar + name + age  |  score pill */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <MemberAvatar
                    avatarStyle={(member as any).avatarStyle ?? null}
                    avatarSeed={(member as any).avatarSeed ?? null}
                    avatarOptions={((member as any).avatarOptions as Record<string, unknown>) ?? null}
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

                {/* Score pill */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
                    config.pillBg,
                    config.pillText
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                </span>
              </div>

              {/* Reason */}
              <p className="text-xs text-gray-500 pl-8">{member.reason}</p>

              {/* Affinity insight */}
              {member.affinity?.affinityReason && (
                <p className="text-xs text-indigo-600 pl-8 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 flex-shrink-0" />
                  {member.affinity.affinityReason}
                </p>
              )}

              {/* Quiz prompt for members without preferences */}
              {member.hasPreferences === false && (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="text-xs text-indigo-500 pl-8 flex items-center gap-1 hover:text-indigo-700 transition-colors"
                >
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  Faire le quiz pour des recommandations personnalisées
                </Link>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
