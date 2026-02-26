"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Heart, Bookmark, Settings, UserPlus, ArrowRight } from "lucide-react"

interface Stats {
  familyMembers: number
  favorites: number
  watchlist: number
}

const statCards = [
  {
    key: "familyMembers" as const,
    label: "Membres",
    href: "/profil/famille",
    icon: Users,
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-200",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    key: "favorites" as const,
    label: "Favoris",
    href: "/mes-favoris",
    icon: Heart,
    gradient: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  {
    key: "watchlist" as const,
    label: "À voir",
    href: "/ma-liste",
    icon: Bookmark,
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
]

export function WelcomeHeader() {
  const [stats, setStats] = useState<Stats>({ familyMembers: 0, favorites: 0, watchlist: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [familyRes, favRes, watchRes] = await Promise.all([
          fetch("/api/user/family"),
          fetch("/api/user/favorites"),
          fetch("/api/user/watchlist"),
        ])

        const familyData = familyRes.ok ? await familyRes.json() : { familyMembers: [] }
        const favData = favRes.ok ? await favRes.json() : { favorites: [] }
        const watchData = watchRes.ok ? await watchRes.json() : { watchlist: [] }

        setStats({
          familyMembers: familyData.familyMembers?.length || 0,
          favorites: favData.favorites?.length || favData.items?.length || 0,
          watchlist: watchData.watchlist?.length || watchData.items?.length || 0,
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.key} href={card.href} className="group">
              <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                {/* Decorative corner gradient */}
                <div className={`absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br ${card.gradient} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`} />

                <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${card.gradient} shadow-md ${card.shadow} mb-3`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>

                <div className="text-2xl sm:text-3xl font-black text-gray-900">
                  {loading ? (
                    <div className="h-8 w-10 bg-gray-100 rounded animate-pulse" />
                  ) : (
                    stats[card.key]
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{card.label}</div>

                <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/profil/famille"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-full transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Ajouter un membre
        </Link>
        <Link
          href="/profil"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Préférences
        </Link>
      </div>
    </div>
  )
}
