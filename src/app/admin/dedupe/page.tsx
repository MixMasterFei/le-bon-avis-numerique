"use client"

import { useState, useEffect } from "react"
import {
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Gamepad2,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DuplicateEntry {
  id: string
  title: string
  platforms: string[]
}

interface DuplicateGroup {
  title: string
  count: number
  entries: DuplicateEntry[]
}

interface DedupeStats {
  totalGames: number
  uniqueTitles: number
  duplicateGroups: number
  potentialToRemove: number
  duplicates: DuplicateGroup[]
}

interface DedupeResult {
  checked: number
  merged: number
  deleted: number
  details: string[]
}

export default function DedupePage() {
  const [stats, setStats] = useState<DedupeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<DedupeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/dedupe")
      if (res.ok) {
        setStats(await res.json())
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

  const handleDedupe = async (dryRun: boolean) => {
    setProcessing(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/admin/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Deduplication failed")
      }

      setResult(data.result)
      if (!dryRun) {
        fetchStats() // Refresh stats after real dedupe
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-orange-500 rounded-xl text-white">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold">Deduplication des jeux</h1>
        </div>
        <p className="text-gray-600">
          Fusionner les jeux en double (meme jeu sur differentes plateformes).
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total jeux</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : stats?.totalGames || 0}
                </p>
              </div>
              <Gamepad2 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Titres uniques</p>
                <p className="text-2xl font-bold text-green-600">
                  {loading ? "..." : stats?.uniqueTitles || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Groupes en double</p>
                <p className="text-2xl font-bold text-orange-600">
                  {loading ? "..." : stats?.duplicateGroups || 0}
                </p>
              </div>
              <Layers className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">A supprimer</p>
                <p className="text-2xl font-bold text-red-600">
                  {loading ? "..." : stats?.potentialToRemove || 0}
                </p>
              </div>
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              La deduplication va fusionner les jeux avec le meme titre en combinant leurs plateformes.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => handleDedupe(true)}
                disabled={processing || (stats?.duplicateGroups || 0) === 0}
                variant="outline"
                className="flex-1"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Simuler (dry run)
              </Button>

              <Button
                onClick={() => handleDedupe(false)}
                disabled={processing || (stats?.duplicateGroups || 0) === 0}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Fusionner
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <RefreshCw className="h-5 w-5 text-gray-400" />
              )}
              Resultat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{result.checked}</p>
                    <p className="text-xs text-gray-500">Verifies</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-700">{result.merged}</p>
                    <p className="text-xs text-orange-600">Groupes fusionnes</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-700">{result.deleted}</p>
                    <p className="text-xs text-red-600">Supprimes</p>
                  </div>
                </div>

                {result.details.length > 0 && (
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1 p-3 bg-gray-50 rounded-lg">
                    {result.details.slice(0, 20).map((detail, i) => (
                      <p key={i} className="text-gray-600 truncate">
                        {detail}
                      </p>
                    ))}
                    {result.details.length > 20 && (
                      <p className="text-gray-400">
                        ... et {result.details.length - 20} autres
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!result && !error && (
              <p className="text-gray-500 text-center py-8">
                Lancez une simulation pour voir les resultats
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Duplicates List */}
      {stats?.duplicates && stats.duplicates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Doublons detectes ({stats.duplicateGroups})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.duplicates.map((group, i) => (
                <div
                  key={i}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{group.title}</span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded">
                      {group.count} entrees
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    {group.entries.map((entry, j) => (
                      <div key={j} className="flex justify-between">
                        <span className="truncate">{entry.title}</span>
                        <span className="text-xs">
                          {entry.platforms.join(", ") || "Pas de plateforme"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
