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
  Sparkles,
  TrendingUp,
  Users,
  Play,
  Star,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface DbStats {
  total: number
  movies: number
  series: number
  games: number
  enriched: number
  percentComplete: number
  quality: {
    enriched: number
    enrichedPercent: number
    highQuality: number
    mediumQuality: number
    lowQuality: number
    avgScore: number
    withStreaming: number
    withCredits: number
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [computingQuality, setComputingQuality] = useState(false)
  const [cachingStreaming, setCachingStreaming] = useState(false)
  const [computingSimilarity, setComputingSimilarity] = useState(false)

  const fetchStats = async () => {
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
          quality: data.quality || {
            enriched: 0,
            enrichedPercent: 0,
            highQuality: 0,
            mediumQuality: 0,
            lowQuality: 0,
            avgScore: 0,
            withStreaming: 0,
            withCredits: 0,
          },
        })
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleComputeQuality = async () => {
    setComputingQuality(true)
    try {
      const res = await fetch("/api/admin/quality/compute", { method: "POST" })
      if (res.ok) {
        fetchStats()
      }
    } catch (err) {
      console.error("Failed to compute quality:", err)
    } finally {
      setComputingQuality(false)
    }
  }

  const handleCacheStreaming = async () => {
    setCachingStreaming(true)
    try {
      const res = await fetch("/api/admin/streaming/cache", { method: "POST" })
      if (res.ok) {
        fetchStats()
      }
    } catch (err) {
      console.error("Failed to cache streaming:", err)
    } finally {
      setCachingStreaming(false)
    }
  }

  const handleComputeSimilarity = async () => {
    setComputingSimilarity(true)
    try {
      const res = await fetch("/api/admin/similarity/compute", { method: "POST" })
      if (res.ok) {
        fetchStats()
      }
    } catch (err) {
      console.error("Failed to compute similarity:", err)
    } finally {
      setComputingSimilarity(false)
    }
  }

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

      {/* Data Quality Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Qualite des donnees
          </CardTitle>
          <CardDescription>
            Score de qualite et completude des fiches media
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            {/* Quality Score */}
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold text-yellow-700">
                {loading ? "..." : `${stats?.quality.avgScore || 0}`}
              </p>
              <p className="text-xs text-yellow-600">Score moyen</p>
            </div>

            {/* High Quality */}
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-700">
                {loading ? "..." : stats?.quality.highQuality || 0}
              </p>
              <p className="text-xs text-green-600">Haute qualite (70+)</p>
            </div>

            {/* Medium Quality */}
            <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-600" />
              <p className="text-2xl font-bold text-amber-700">
                {loading ? "..." : stats?.quality.mediumQuality || 0}
              </p>
              <p className="text-xs text-amber-600">Moyenne (30-69)</p>
            </div>

            {/* Low Quality */}
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <p className="text-2xl font-bold text-red-700">
                {loading ? "..." : stats?.quality.lowQuality || 0}
              </p>
              <p className="text-xs text-red-600">Faible (&lt;30)</p>
            </div>

            {/* With Streaming */}
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <Play className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-700">
                {loading ? "..." : stats?.quality.withStreaming || 0}
              </p>
              <p className="text-xs text-purple-600">Avec streaming</p>
            </div>

            {/* With Credits */}
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-700">
                {loading ? "..." : stats?.quality.withCredits || 0}
              </p>
              <p className="text-xs text-blue-600">Avec credits</p>
            </div>
          </div>

          {/* Quality Progress Bar */}
          {!loading && stats && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Progression qualite</span>
                <span className="font-medium">{stats.quality.enrichedPercent}% enrichi</span>
              </div>
              <Progress value={stats.quality.enrichedPercent} className="h-3" />
            </div>
          )}

          {/* Quality Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleComputeQuality}
              disabled={computingQuality}
              variant="outline"
              className="border-yellow-300 hover:bg-yellow-50"
            >
              {computingQuality ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalculer scores qualite
            </Button>

            <Button
              onClick={handleCacheStreaming}
              disabled={cachingStreaming}
              variant="outline"
              className="border-purple-300 hover:bg-purple-50"
            >
              {cachingStreaming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Mettre a jour streaming
            </Button>

            <Button
              onClick={handleComputeSimilarity}
              disabled={computingSimilarity}
              variant="outline"
              className="border-blue-300 hover:bg-blue-50"
            >
              {computingSimilarity ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Calculer similarites
            </Button>
          </div>
        </CardContent>
      </Card>

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
