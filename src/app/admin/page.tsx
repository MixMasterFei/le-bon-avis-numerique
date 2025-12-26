"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Film,
  Tv,
  Gamepad2,
  Upload,
  Brain,
  Copy,
  BarChart3,
  Database,
  Settings,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface DbStats {
  total: number
  movies: number
  series: number
  games: number
  enriched: number
  percentComplete: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/db/stats")
        if (res.ok) {
          const data = await res.json()
          const enriched = (data.coverage?.moviesWithAgeRec || 0) + (data.coverage?.gamesWithAgeRec || 0)
          const total = data.counts?.total || 0
          setStats({
            total: total,
            movies: data.counts?.movies || 0,
            series: data.counts?.tv || 0,
            games: data.counts?.games || 0,
            enriched: enriched,
            percentComplete: total > 0 ? Math.round((enriched / total) * 100) : 0,
          })
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const adminSections = [
    {
      title: "Import en masse",
      description: "Importer des films et jeux depuis TMDB/IGDB",
      href: "/admin/import/bulk",
      icon: Upload,
      color: "bg-blue-500",
    },
    {
      title: "Enrichissement IA",
      description: "Evaluer automatiquement les contenus avec OpenAI",
      href: "/admin/enrich",
      icon: Brain,
      color: "bg-purple-500",
    },
    {
      title: "Deduplication",
      description: "Trouver et fusionner les doublons",
      href: "/admin/dedupe",
      icon: Copy,
      color: "bg-orange-500",
    },
    {
      title: "Generer des avis",
      description: "Creer des avis synthetiques pour les tests",
      href: "/admin/generate",
      icon: Settings,
      color: "bg-green-500",
    },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-gray-600">
          Gerez le contenu de la base de donnees et les evaluations.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.total || 0}
              </p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Film className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">
                {loading ? "..." : stats?.movies || 0}
              </p>
              <p className="text-xs text-gray-500">Films</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Tv className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">
                {loading ? "..." : stats?.series || 0}
              </p>
              <p className="text-xs text-gray-500">Series</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                {loading ? "..." : stats?.games || 0}
              </p>
              <p className="text-xs text-gray-500">Jeux</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">
                {loading ? "..." : stats?.enriched || 0}
              </p>
              <p className="text-xs text-gray-500">Enrichis</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-teal-500" />
              <p className="text-2xl font-bold">
                {loading ? "..." : `${stats?.percentComplete || 0}%`}
              </p>
              <p className="text-xs text-gray-500">Complete</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {adminSections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl text-white ${section.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {section.title}
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Liens rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/films"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Voir les films
            </Link>
            <Link
              href="/series"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Voir les series
            </Link>
            <Link
              href="/jeux-video"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Voir les jeux
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Accueil
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
