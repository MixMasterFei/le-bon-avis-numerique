"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useState, useEffect } from "react"
import { User, Mail, Calendar, Shield, Star, Heart, Bookmark, Users, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FamilyMembers } from "@/components/profile/FamilyMembers"
import Link from "next/link"

interface UserStats {
  reviews: number
  favorites: number
  watchlist: number
  familyMembers: number
  reactions: number
  memberSince: string
}

export default function ProfilPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/user/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoadingStats(false)
      }
    }

    if (session?.user) {
      fetchStats()
    }
  }, [session])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  const isAdmin = session.user.role === "ADMIN"

  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "Profil"}
                className="h-24 w-24 rounded-full"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-12 w-12 text-primary" />
              </div>
            )}

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold text-gray-900">
                  {session.user.name || "Utilisateur"}
                </h1>
                {isAdmin && (
                  <Badge className="bg-purple-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 flex items-center gap-2 justify-center sm:justify-start mt-1">
                <Mail className="h-4 w-4" />
                {session.user.email}
              </p>
              {stats && (
                <p className="text-sm text-gray-500 flex items-center gap-2 justify-center sm:justify-start mt-1">
                  <Calendar className="h-4 w-4" />
                  Membre depuis {formatMemberSince(stats.memberSince)}
                </p>
              )}
            </div>

            <Button variant="outline">Modifier le profil</Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-amber-100 rounded-full mb-3">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.reviews || 0}
            </p>
            <p className="text-sm text-gray-600">Avis</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-red-100 rounded-full mb-3">
              <Heart className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.favorites || 0}
            </p>
            <p className="text-sm text-gray-600">Favoris</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-blue-100 rounded-full mb-3">
              <Bookmark className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.watchlist || 0}
            </p>
            <p className="text-sm text-gray-600">A voir</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-green-100 rounded-full mb-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.reactions || 0}
            </p>
            <p className="text-sm text-gray-600">Reactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Family Members */}
      <FamilyMembers />

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Mes listes</CardTitle>
          <CardDescription>Accedez a vos contenus sauvegardes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/mes-favoris">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="p-3 bg-red-100 rounded-full">
                  <Heart className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">Mes favoris</p>
                  <p className="text-sm text-gray-500">{stats?.favorites || 0} contenus</p>
                </div>
              </div>
            </Link>
            <Link href="/ma-liste">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Bookmark className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Ma liste a voir</p>
                  <p className="text-sm text-gray-500">{stats?.watchlist || 0} contenus</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Parametres du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Notifications par email</p>
              <p className="text-sm text-gray-500">Recevoir les nouveautes et recommandations</p>
            </div>
            <Button variant="outline" size="sm">Configurer</Button>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Gestion des cookies</p>
              <p className="text-sm text-gray-500">Modifier vos preferences de cookies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cookies">Gerer</Link>
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600">Supprimer mon compte</p>
              <p className="text-sm text-gray-500">Cette action est irreversible</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
