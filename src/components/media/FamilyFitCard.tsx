"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, LogIn, UserPlus, Check, AlertTriangle, X as XIcon, Sparkles, Lightbulb } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
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
      <Card>
        <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Adapté à ma famille ?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-gray-500 mb-3">
            Connectez-vous pour une évaluation personnalisée
          </p>
          <Link
            href="/connexion"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
        </CardContent>
      </Card>
    )
  }

  // ---------- No family members ----------
  if (data?.status === "no_family") {
    return (
      <Card>
        <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Adapté à ma famille ?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-gray-500 mb-3">
            Créez votre profil famille pour voir si ce contenu convient à vos enfants
          </p>
          <Link
            href="/profil/parametres-famille"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Créer mon profil famille
          </Link>
        </CardContent>
      </Card>
    )
  }

  // ---------- No data (fetch error) ----------
  if (!data || data.status !== "ok") return null

  // ---------- OK: show members ----------
  const { members } = data

  return (
    <Card>
      <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          Adapté à ma famille ?
        </CardTitle>
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
                  <span className="text-xl flex-shrink-0" role="img" aria-label={member.name}>
                    {member.avatarEmoji}
                  </span>
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
