"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, LogIn, UserPlus, Check, AlertTriangle, X as XIcon, Sparkles, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

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
    pillBg: "bg-green-500/20",
    pillText: "text-green-300",
    icon: Check,
  },
  good: {
    label: "Bon",
    pillBg: "bg-blue-500/20",
    pillText: "text-blue-300",
    icon: Check,
  },
  moderate: {
    label: "Modéré",
    pillBg: "bg-amber-500/20",
    pillText: "text-amber-300",
    icon: AlertTriangle,
  },
  poor: {
    label: "Attention",
    pillBg: "bg-red-500/20",
    pillText: "text-red-300",
    icon: XIcon,
  },
}

// ---------------------------------------------------------------------------
// Skeleton (dark variant)
// ---------------------------------------------------------------------------

function HeroSkeleton() {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-5 rounded bg-white/20 animate-pulse" />
        <div className="h-5 w-36 rounded bg-white/20 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
              <div className="h-4 w-20 rounded bg-white/20 animate-pulse" />
            </div>
            <div className="h-6 w-16 rounded-full bg-white/20 animate-pulse" />
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

  // ---------- Not logged in ----------
  if (data?.status === "not_logged_in") {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Adapté à votre foyer ?
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Créez un profil famille pour découvrir si ce contenu convient à chaque membre de votre foyer.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Créer mon profil
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white/80 border border-white/20 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Gratuit — 2 minutes. Modifiable à tout moment.
        </p>
      </div>
    )
  }

  // ---------- No family members ----------
  if (data?.status === "no_family") {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Adapté à votre foyer ?
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Ajoutez les membres de votre foyer pour voir si ce contenu leur convient.
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un membre
        </Link>
      </div>
    )
  }

  // ---------- No data (fetch error) ----------
  if (!data || data.status !== "ok") return null

  // ---------- OK: show members ----------
  const { members } = data

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
      <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-indigo-300" />
        Adapté à ma famille ?
      </h3>
      <div className="space-y-3">
        {members.map((member) => {
          const config = LEVEL_CONFIG[member.level]
          const Icon = config.icon

          return (
            <div key={member.id} className="space-y-1">
              {/* Top row: avatar + name + age  |  score pill */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0" role="img" aria-label={member.name}>
                    {member.avatarEmoji}
                  </span>
                  <span className="font-medium text-sm text-white truncate">{member.name}</span>
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
              <p className="text-xs text-gray-400 pl-7">{member.reason}</p>

              {/* Affinity insight */}
              {member.affinity?.affinityReason && (
                <p className="text-xs text-indigo-300 pl-7 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 flex-shrink-0" />
                  {member.affinity.affinityReason}
                </p>
              )}

              {/* Quiz prompt for members without preferences */}
              {member.hasPreferences === false && (
                <Link
                  href={`/profil/quiz/${member.id}`}
                  className="text-xs text-indigo-300 pl-7 flex items-center gap-1 hover:text-indigo-200 transition-colors"
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
