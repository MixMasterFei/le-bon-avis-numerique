"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  Library,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
  BarChart3,
  Search,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface EnrichmentStats {
  stats: Record<string, number>
  enrichment: {
    withMetrics: number
    withoutMetrics: number
    withoutAgeRec: number
    percentComplete: number
  }
  confidence?: {
    high: number
    medium: number
    low: number
    unscored: number
    needsDeepEnrich: number
    deepEnriched: number
    hasV2Fields: number
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

type MediaType = "all" | "movie" | "tv" | "game" | "manga"

export default function EnrichPage() {
  const [stats, setStats] = useState<EnrichmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [selectedType, setSelectedType] = useState<MediaType>("all")
  const [batchSize, setBatchSize] = useState(25)
  const [forceReenrich, setForceReenrich] = useState(false)
  const [result, setResult] = useState<EnrichmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Deep enrichment
  const [deepEnriching, setDeepEnriching] = useState(false)
  const [deepResult, setDeepResult] = useState<{ enriched: number; remaining: number } | null>(null)
  // Auto-enrich mode
  const [autoMode, setAutoMode] = useState(false)
  const [autoProgress, setAutoProgress] = useState({ total: 0, done: 0, errors: 0 })
  const stopRequestedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  const runSingleBatch = async (signal?: AbortSignal, limitOverride?: number): Promise<EnrichmentResult | null> => {
    const res = await fetch("/api/admin/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: selectedType,
        limit: limitOverride ?? batchSize,
        onlyMissing: !forceReenrich,
      }),
      signal,
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Enrichment failed")
    }

    return data.result
  }

  const handleEnrich = async () => {
    setEnriching(true)
    setError(null)
    setResult(null)

    try {
      const batchResult = await runSingleBatch()
      setResult(batchResult)
      fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setEnriching(false)
    }
  }

  // Auto-enrich: runs batches continuously until done or stopped
  const handleAutoEnrich = async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setAutoMode(true)
    stopRequestedRef.current = false
    setError(null)
    setEnriching(true)

    const totalToEnrich = stats?.enrichment.withoutMetrics || 0
    setAutoProgress({ total: totalToEnrich, done: 0, errors: 0 })

    let totalDone = 0
    let totalErrors = 0

    // Use small batches (5 items) in auto mode to stay within Vercel's 60s function timeout
    // Each item takes ~7-8s for OpenAI analysis, so 5 items ≈ 40s
    const autoBatchSize = 5

    while (!stopRequestedRef.current && !controller.signal.aborted) {
      try {
        const batchResult = await runSingleBatch(controller.signal, autoBatchSize)

        if (!batchResult || batchResult.processed === 0) {
          break
        }

        totalDone += batchResult.enriched
        totalErrors += batchResult.errors
        setAutoProgress({ total: totalToEnrich, done: totalDone, errors: totalErrors })
        setResult(batchResult)

        if (batchResult.enriched === 0 && batchResult.skipped === 0) {
          break
        }

        if (stopRequestedRef.current) break

        await new Promise(resolve => setTimeout(resolve, 1000))
        await fetchStats()

      } catch (err) {
        // AbortError means user clicked stop — exit cleanly
        if (err instanceof DOMException && err.name === "AbortError") {
          break
        }
        totalErrors++
        setAutoProgress(prev => ({ ...prev, errors: totalErrors }))
        setError(err instanceof Error ? err.message : "Erreur")
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    abortControllerRef.current = null
    setEnriching(false)
    setAutoMode(false)
    fetchStats()
  }

  const handleStopAuto = () => {
    stopRequestedRef.current = true
    abortControllerRef.current?.abort()
  }

  const handleDeepEnrich = async () => {
    setDeepEnriching(true)
    setDeepResult(null)
    try {
      const res = await fetch("/api/admin/enrich-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      })
      const data = await res.json()
      if (res.ok) {
        setDeepResult({ enriched: data.result?.enriched || 0, remaining: data.remaining || 0 })
        fetchStats()
      } else {
        setError(data.error || "Deep enrichment failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setDeepEnriching(false)
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

      {/* Confidence Distribution + Deep Enrichment */}
      {stats?.confidence && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Confidence Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Distribution de confiance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Haute (&ge; 0.7)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: `${stats.enrichment.withMetrics > 0
                            ? (stats.confidence.high / stats.enrichment.withMetrics) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{stats.confidence.high}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Moyenne (0.4-0.7)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{
                          width: `${stats.enrichment.withMetrics > 0
                            ? (stats.confidence.medium / stats.enrichment.withMetrics) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{stats.confidence.medium}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Basse (&lt; 0.4)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${stats.enrichment.withMetrics > 0
                            ? (stats.confidence.low / stats.enrichment.withMetrics) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{stats.confidence.low}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Non evalue</span>
                  <span className="text-sm font-medium text-gray-400">{stats.confidence.unscored}</span>
                </div>
                <div className="pt-2 border-t text-xs text-gray-500">
                  {stats.confidence.hasV2Fields} contenus avec tags v2 (tonalite, rythme, emotions)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deep Enrichment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-600" />
                Enrichissement approfondi (Pass 2)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-700">{stats.confidence.needsDeepEnrich}</p>
                  <p className="text-xs text-orange-600">En attente</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-700">{stats.confidence.deepEnriched}</p>
                  <p className="text-xs text-indigo-600">Deja enrichis</p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                GPT-5 avec recherche web. Verifie et corrige les metriques Pass 1.
                Cout: ~0.02€/contenu.
              </p>

              <Button
                onClick={handleDeepEnrich}
                disabled={deepEnriching || stats.confidence.needsDeepEnrich === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {deepEnriching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enrichissement profond...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Lancer un lot de 5
                  </>
                )}
              </Button>

              {deepResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                  {deepResult.enriched} enrichis en profondeur. {deepResult.remaining} restants.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                  { value: "manga", label: "Mangas", icon: Library },
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
                <option value={3}>3 contenus (~25s)</option>
                <option value={5}>5 contenus (~40s)</option>
                <option value={10}>10 contenus (~80s, peut timeout)</option>
                <option value={25}>25 contenus (~3min, risque de timeout)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Cout estime: ~{(batchSize * 0.0013).toFixed(3)}$ (gpt-5-mini)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forceReenrich"
                checked={forceReenrich}
                onChange={(e) => setForceReenrich(e.target.checked)}
                disabled={enriching}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="forceReenrich" className="text-sm text-gray-600">
                Re-enrichir tous les contenus (meme deja evalues)
              </label>
            </div>

            {/* Warning if no content */}
            {!loading && Object.values(stats?.stats || {}).reduce((a, b) => a + b, 0) === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Aucun contenu en base. Importez d&apos;abord des films/jeux depuis{" "}
                <a href="/admin/import/bulk" className="underline font-medium">
                  Import en masse
                </a>
              </div>
            )}

            {/* Auto-enrich progress bar */}
            {autoMode && (
              <div className="space-y-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-purple-700">
                    Enrichissement automatique en cours...
                  </span>
                  <span className="text-purple-600">
                    {autoProgress.done} / {autoProgress.total}
                  </span>
                </div>
                <Progress
                  value={autoProgress.total > 0 ? (autoProgress.done / autoProgress.total) * 100 : 0}
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {autoProgress.total > 0
                      ? Math.round((autoProgress.done / autoProgress.total) * 100)
                      : 0}% complete
                  </span>
                  {autoProgress.errors > 0 && (
                    <span className="text-red-500">{autoProgress.errors} erreurs</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {/* Single batch button */}
              <Button
                onClick={handleEnrich}
                disabled={
                  enriching ||
                  Object.values(stats?.stats || {}).reduce((a, b) => a + b, 0) === 0 ||
                  (!forceReenrich && (stats?.enrichment.withoutMetrics || 0) === 0)
                }
                variant="outline"
                className="flex-1"
              >
                {enriching && !autoMode ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    En cours...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Un lot ({batchSize})
                  </>
                )}
              </Button>

              {/* Auto-enrich button or Stop button */}
              {autoMode ? (
                <Button
                  onClick={handleStopAuto}
                  variant="destructive"
                  className="flex-1"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Arreter
                </Button>
              ) : (
                <Button
                  onClick={handleAutoEnrich}
                  disabled={
                    enriching ||
                    Object.values(stats?.stats || {}).reduce((a, b) => a + b, 0) === 0 ||
                    (!forceReenrich && (stats?.enrichment.withoutMetrics || 0) === 0)
                  }
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Tout enrichir auto
                </Button>
              )}
            </div>

            {!autoMode && (stats?.enrichment.withoutMetrics || 0) > 0 && (
              <p className="text-xs text-center text-gray-500">
                &quot;Tout enrichir&quot; traitera les {stats?.enrichment.withoutMetrics} elements restants automatiquement
              </p>
            )}
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
              <strong>Pass 1 (GPT-5 Mini):</strong> Analyse le titre, synopsis et genres. Produit age recommande,
              metriques de contenu, tonalite, rythme, style visuel et themes emotionnels. ~0.0013$/contenu.
            </li>
            <li>
              <strong>Pass 2 (GPT-5 + recherche web):</strong> Verifie et corrige les resultats Pass 1 pour
              les contenus a faible confiance. Enrichit le synopsis et les conseils parents. ~0.02$/contenu.
            </li>
            <li>
              Un score de confiance (0-1) est calcule pour chaque contenu. Les contenus sous 0.6 sont
              automatiquement marques pour l&apos;enrichissement approfondi.
            </li>
            <li>
              Les tags de tonalite et themes emotionnels alimentent le systeme de personnalisation
              (Family Fit, similarites, recommandations).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
