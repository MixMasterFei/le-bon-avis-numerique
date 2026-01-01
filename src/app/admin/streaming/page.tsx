"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import {
  Tv,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Play
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"

interface PlatformStat {
  platform: string
  count: number
}

interface Stats {
  stats: { type: string; _count: number }[]
  withPlatforms: number
  withoutPlatforms: number
  platformDistribution: PlatformStat[]
}

export default function StreamingAdminPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState({ processed: 0, total: 0 })
  const [updateLog, setUpdateLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/streaming/update")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchStats()
    }
  }, [session])

  const runUpdate = async (batchSize: number = 50) => {
    setUpdating(true)
    setUpdateLog([])
    setError(null)
    let offset = 0
    let hasMore = true

    while (hasMore && updating !== false) {
      try {
        const res = await fetch("/api/admin/streaming/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: batchSize,
            offset,
            onlyEmpty: true,
            mediaType: "MOVIE",
          }),
        })

        if (!res.ok) {
          throw new Error("Update failed")
        }

        const data = await res.json()
        setUpdateProgress({
          processed: data.pagination.processed,
          total: data.pagination.total,
        })

        // Add recent updates to log
        if (data.stats.details.length > 0) {
          setUpdateLog(prev => [...data.stats.details.slice(0, 10), ...prev].slice(0, 50))
        }

        hasMore = data.pagination.hasMore
        offset = data.pagination.nextOffset

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed")
        hasMore = false
      }
    }

    setUpdating(false)
    fetchStats() // Refresh stats after update
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/")
  }

  const totalMedia = stats?.stats.reduce((sum, s) => sum + s._count, 0) || 0
  const percentWithPlatforms = totalMedia > 0
    ? Math.round((stats?.withPlatforms || 0) / totalMedia * 100)
    : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm">Retour</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tv className="h-6 w-6" />
            Gestion des Plateformes Streaming
          </h1>
          <p className="text-gray-600">
            Mise a jour des disponibilites via JustWatch/TMDB
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Media</p>
                <p className="text-2xl font-bold">{totalMedia}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avec plateformes</p>
                <p className="text-2xl font-bold text-green-600">{stats?.withPlatforms || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={percentWithPlatforms} className="mt-2" />
            <p className="text-xs text-gray-500 mt-1">{percentWithPlatforms}% du catalogue</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sans plateformes</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.withoutPlatforms || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Distribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Distribution par plateforme</CardTitle>
          <CardDescription>Nombre de films disponibles par service de streaming</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.platformDistribution && stats.platformDistribution.length > 0 ? (
            <div className="space-y-3">
              {stats.platformDistribution.map(({ platform, count }) => (
                <div key={platform} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium">{platform}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{
                        width: `${Math.min(100, (count / (stats.withPlatforms || 1)) * 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Aucune donnee de plateforme disponible
            </p>
          )}
        </CardContent>
      </Card>

      {/* Update Action */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Mettre a jour les plateformes
          </CardTitle>
          <CardDescription>
            Recupere les disponibilites streaming depuis TMDB (donnees JustWatch).
            Cela peut prendre plusieurs minutes selon le nombre de films.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={() => runUpdate(50)}
              disabled={updating || !stats?.withoutPlatforms}
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Mise a jour en cours...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Lancer la mise a jour ({stats?.withoutPlatforms || 0} films)
                </>
              )}
            </Button>

            {updating && (
              <Button variant="outline" onClick={() => setUpdating(false)}>
                Arreter
              </Button>
            )}
          </div>

          {updating && updateProgress.total > 0 && (
            <div className="space-y-2">
              <Progress
                value={(updateProgress.processed / updateProgress.total) * 100}
              />
              <p className="text-sm text-gray-600">
                {updateProgress.processed} / {updateProgress.total} traites
              </p>
            </div>
          )}

          {updateLog.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Dernieres mises a jour :</p>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                {updateLog.map((log, i) => (
                  <div key={i} className="text-gray-600">{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
