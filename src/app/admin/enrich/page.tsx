"use client"

import { useState, useEffect } from "react"
import {
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface EnrichmentStats {
  stats: Record<string, number>
  enrichment: {
    withMetrics: number
    withoutMetrics: number
    percentComplete: number
  }
  recentlyEnriched: Array<{
    title: string
    type: string
    expertAgeRec: number | null
    updatedAt: string
  }>
}

interface EnrichmentResult {
  processed: number
  enriched: number
  skipped: number
  errors: number
  details: string[]
}

type MediaType = "all" | "movie" | "tv" | "game"

export default function EnrichPage() {
  const [stats, setStats] = useState<EnrichmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [selectedType, setSelectedType] = useState<MediaType>("all")
  const [batchSize, setBatchSize] = useState(10)
  const [result, setResult] = useState<EnrichmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/enrich")
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

  const handleEnrich = async () => {
    setEnriching(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/admin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          limit: batchSize,
          onlyMissing: true,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Enrichment failed")
      }

      setResult(data.result)
      fetchStats() // Refresh stats
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setEnriching(false)
    }
  }

  const typeIcons = {
    MOVIE: Film,
    TV: Tv,
    GAME: Gamepad2,
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-purple-500 rounded-xl text-white">
            <Brain className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold">Enrichissement IA</h1>
        </div>
        <p className="text-gray-600">
          Utilisez l&apos;IA pour evaluer automatiquement les films, series et jeux.
          Les evaluations incluent l&apos;age recommande et les metriques de contenu.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total contenus</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : Object.values(stats?.stats || {}).reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Enrichis</p>
                <p className="text-2xl font-bold text-green-600">
                  {loading ? "..." : stats?.enrichment.withMetrics || 0}
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
                <p className="text-sm text-gray-500">A enrichir</p>
                <p className="text-2xl font-bold text-orange-600">
                  {loading ? "..." : stats?.enrichment.withoutMetrics || 0}
                </p>
              </div>
              <Sparkles className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Progression</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : `${stats?.enrichment.percentComplete || 0}%`}
                </p>
              </div>
              <Progress
                value={stats?.enrichment.percentComplete || 0}
                className="w-16 h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Lancer l&apos;enrichissement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type de contenu</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Tous", icon: BarChart3 },
                  { value: "movie", label: "Films", icon: Film },
                  { value: "tv", label: "Series", icon: Tv },
                  { value: "game", label: "Jeux", icon: Gamepad2 },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={selectedType === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType(value as MediaType)}
                    disabled={enriching}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre par lot
              </label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                disabled={enriching}
              >
                <option value={5}>5 contenus</option>
                <option value={10}>10 contenus</option>
                <option value={25}>25 contenus</option>
                <option value={50}>50 contenus (max)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Cout estime: ~{(batchSize * 0.002).toFixed(3)}$ (gpt-4o-mini)
              </p>
            </div>

            <Button
              onClick={handleEnrich}
              disabled={enriching || (stats?.enrichment.withoutMetrics || 0) === 0}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {enriching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrichissement en cours...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Lancer l&apos;enrichissement IA
                </>
              )}
            </Button>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{result.processed}</p>
                    <p className="text-xs text-gray-500">Traites</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{result.enriched}</p>
                    <p className="text-xs text-green-600">Enrichis</p>
                  </div>
                </div>

                {result.details.length > 0 && (
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1 p-3 bg-gray-50 rounded-lg">
                    {result.details.map((detail, i) => (
                      <p key={i} className={detail.startsWith("✓") ? "text-green-600" : detail.startsWith("✗") ? "text-red-600" : "text-gray-600"}>
                        {detail}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!result && !error && (
              <p className="text-gray-500 text-center py-8">
                Lancez un enrichissement pour voir les resultats
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently Enriched */}
      {stats?.recentlyEnriched && stats.recentlyEnriched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recemment enrichis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentlyEnriched.map((item, i) => {
                const Icon = typeIcons[item.type as keyof typeof typeIcons] || Film
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {item.expertAgeRec && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {item.expertAgeRec}+
                        </span>
                      )}
                      <span>
                        {new Date(item.updatedAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Comment ca marche</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>
              L&apos;IA analyse le titre, le synopsis et les genres pour determiner l&apos;age recommande.
            </li>
            <li>
              Les metriques de contenu (violence, langage, etc.) sont evaluees sur une echelle de 0 a 5.
            </li>
            <li>
              Des tags thematiques sont attribues pour les collections (Noel, Halloween, etc.).
            </li>
            <li>
              Seuls les contenus sans evaluation sont traites (pas de doublons).
            </li>
            <li>
              Le cout OpenAI est d&apos;environ 0.002$ par contenu avec gpt-4o-mini.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
