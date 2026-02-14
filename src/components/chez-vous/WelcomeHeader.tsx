"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Heart, Bookmark, Settings, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
}

interface Stats {
  familyMembers: number
  favorites: number
  watchlist: number
}

export function WelcomeHeader() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats>({ familyMembers: 0, favorites: 0, watchlist: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch family members count
        const familyRes = await fetch("/api/user/family")
        const familyData = familyRes.ok ? await familyRes.json() : { familyMembers: [] }

        // Fetch favorites count
        const favRes = await fetch("/api/user/favorites")
        const favData = favRes.ok ? await favRes.json() : { favorites: [] }

        // Fetch watchlist count
        const watchRes = await fetch("/api/user/watchlist")
        const watchData = watchRes.ok ? await watchRes.json() : { watchlist: [] }

        setStats({
          familyMembers: familyData.familyMembers?.length || 0,
          favorites: favData.favorites?.length || 0,
          watchlist: watchData.watchlist?.length || 0,
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const firstName = session?.user?.name?.split(" ")[0] || "vous"

  return (
    <Card className="p-6 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Bienvenue, {firstName} !
          </h2>
          <p className="text-gray-600 mt-1">
            Retrouvez vos recommandations personnalisées et gérez votre famille.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/profil/famille">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un membre
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/profil">
              <Settings className="h-4 w-4 mr-2" />
              Préférences
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Link href="/profil/famille" className="group">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
            <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {loading ? "..." : stats.familyMembers}
              </div>
              <div className="text-xs text-gray-600">Membres</div>
            </div>
          </div>
        </Link>

        <Link href="/mes-favoris" className="group">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-50 group-hover:bg-pink-100 transition-colors">
            <div className="p-2 bg-pink-100 rounded-lg group-hover:bg-pink-200 transition-colors">
              <Heart className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-600">
                {loading ? "..." : stats.favorites}
              </div>
              <div className="text-xs text-gray-600">Favoris</div>
            </div>
          </div>
        </Link>

        <Link href="/ma-liste" className="group">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors">
            <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
              <Bookmark className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {loading ? "..." : stats.watchlist}
              </div>
              <div className="text-xs text-gray-600">À voir</div>
            </div>
          </div>
        </Link>
      </div>
    </Card>
  )
}
