"use client"

import { useState, useEffect, useRef } from "react"
import {
  Film,
  Gamepad2,
  Tv,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Database,
  Loader2,
  Star,
  MessageSquare,
  Sparkles,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ImportStats {
  total: number
  imported: number
  skipped: number
  errors: number
  details: string[]
}

interface DbStats {
  counts: {
    movies: number
    games: number
    tv: number
    books: number
    reviews: number
    total: number
  }
  coverage: {
    moviesWithAgeRec: number
    gamesWithAgeRec: number
    tvWithAgeRec: number
    moviesPercent: number
    gamesPercent: number
    tvPercent: number
  }
  recent: {
    movies: Array<{ id: string; title: string; posterUrl: string; tmdbId: number }>
    games: Array<{ id: string; title: string; posterUrl: string; igdbId: number }>
  }
}

type ImportSource = "popular" | "top_rated" | "now_playing" | "family" | "animation" | "kids" | "recent" | "french" | "classics" | "highly_rated" | "by_year"

const MOVIE_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Films les plus populaires actuellement" },
  { value: "top_rated", label: "Mieux notés", description: "Films les mieux notés de tous les temps" },
  { value: "now_playing", label: "En salles", description: "Films actuellement au cinéma" },
  { value: "recent", label: "Récents", description: "Films des 2 dernières années" },
  { value: "family", label: "Famille", description: "Films pour toute la famille" },
  { value: "animation", label: "Animation", description: "Films d'animation" },
  { value: "kids", label: "Enfants", description: "Films pour enfants (-12 ans)" },
  { value: "french", label: "Films français", description: "Films en langue française" },
  { value: "classics", label: "Classiques", description: "Films classiques (avant 2000)" },
  { value: "highly_rated", label: "Très bien notés", description: "Films avec note > 7/10" },
]

const TV_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Séries les plus populaires" },
  { value: "top_rated", label: "Mieux notées", description: "Séries les mieux notées" },
  { value: "recent", label: "Récentes", description: "Séries des 2 dernières années" },
  { value: "animation", label: "Animation", description: "Séries d'animation" },
  { value: "kids", label: "Enfants", description: "Séries pour enfants" },
  { value: "family", label: "Famille", description: "Séries familiales" },
  { value: "french", label: "Françaises", description: "Séries françaises" },
  { value: "highly_rated", label: "Très bien notées", description: "Séries avec note > 7/10" },
]

const GAME_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Jeux les plus populaires" },
  { value: "family", label: "Famille", description: "Jeux PEGI 3 et PEGI 7" },
  { value: "recent", label: "Récents", description: "Jeux sortis dans les 6 derniers mois" },
]

interface AutoImportProgress {
  isRunning: boolean
  currentSource: string
  sourceIndex: number
  totalSources: number
  currentPage: number
  totalPages: number
  totalImported: number
  totalSkipped: number
  totalErrors: number
}

export default function BulkImportPage() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ type: string; stats: ImportStats } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [movieSource, setMovieSource] = useState<ImportSource>("popular")
  const [moviePages, setMoviePages] = useState(5)
  const [tvSource, setTvSource] = useState<ImportSource>("popular")
  const [tvPages, setTvPages] = useState(5)
  const [gameSource, setGameSource] = useState<ImportSource>("popular")
  const [gameLimit, setGameLimit] = useState(100)

  // Auto-import state
  const [autoImportMovies, setAutoImportMovies] = useState<AutoImportProgress | null>(null)
  const [autoImportTV, setAutoImportTV] = useState<AutoImportProgress | null>(null)
  const [autoImportGames, setAutoImportGames] = useState<AutoImportProgress | null>(null)
  const stopMoviesRef = useRef(false)
  const stopTVRef = useRef(false)
  const stopGamesRef = useRef(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/db/stats")
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

  const handleImport = async (type: "movies" | "tv" | "games") => {
    setImporting(type)
    setError(null)
    setLastResult(null)

    try {
      const endpoint = `/api/admin/import/${type}`
      let body

      if (type === "movies") {
        body = { source: movieSource, pages: moviePages, skipExisting: true }
      } else if (type === "tv") {
        body = { source: tvSource, pages: tvPages, skipExisting: true }
      } else {
        body = { source: gameSource, limit: gameLimit, skipExisting: true }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Import failed")
      }

      setLastResult({ type, stats: data.stats })
      fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setImporting(null)
    }
  }

  // Auto-import movies through all sources
  const handleAutoImportMovies = async () => {
    stopMoviesRef.current = false
    const sources = MOVIE_SOURCES
    const pagesPerSource = 10 // Max pages per source

    setAutoImportMovies({
      isRunning: true,
      currentSource: sources[0].label,
      sourceIndex: 0,
      totalSources: sources.length,
      currentPage: 1,
      totalPages: pagesPerSource,
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
    })

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
      if (stopMoviesRef.current) break

      const source = sources[sourceIdx]

      // Import pages for this source
      for (let startPage = 1; startPage <= 50; startPage += pagesPerSource) {
        if (stopMoviesRef.current) break

        setAutoImportMovies(prev => prev ? {
          ...prev,
          currentSource: source.label,
          sourceIndex: sourceIdx,
          currentPage: startPage,
        } : null)

        try {
          const res = await fetch("/api/admin/import/movies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: source.value,
              pages: pagesPerSource,
              startPage,
              skipExisting: true,
            }),
          })

          const data = await res.json()

          if (res.ok && data.stats) {
            totalImported += data.stats.imported
            totalSkipped += data.stats.skipped
            totalErrors += data.stats.errors

            setAutoImportMovies(prev => prev ? {
              ...prev,
              totalImported,
              totalSkipped,
              totalErrors,
            } : null)

            // If nothing new was imported, move to next source
            if (data.stats.imported === 0) {
              break
            }
          }
        } catch (err) {
          totalErrors++
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setAutoImportMovies(null)
    fetchStats()
  }

  // Auto-import TV through all sources
  const handleAutoImportTV = async () => {
    stopTVRef.current = false
    const sources = TV_SOURCES
    const pagesPerSource = 10

    setAutoImportTV({
      isRunning: true,
      currentSource: sources[0].label,
      sourceIndex: 0,
      totalSources: sources.length,
      currentPage: 1,
      totalPages: pagesPerSource,
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
    })

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
      if (stopTVRef.current) break

      const source = sources[sourceIdx]

      for (let startPage = 1; startPage <= 50; startPage += pagesPerSource) {
        if (stopTVRef.current) break

        setAutoImportTV(prev => prev ? {
          ...prev,
          currentSource: source.label,
          sourceIndex: sourceIdx,
          currentPage: startPage,
        } : null)

        try {
          const res = await fetch("/api/admin/import/tv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: source.value,
              pages: pagesPerSource,
              startPage,
              skipExisting: true,
            }),
          })

          const data = await res.json()

          if (res.ok && data.stats) {
            totalImported += data.stats.imported
            totalSkipped += data.stats.skipped
            totalErrors += data.stats.errors

            setAutoImportTV(prev => prev ? {
              ...prev,
              totalImported,
              totalSkipped,
              totalErrors,
            } : null)

            if (data.stats.imported === 0) {
              break
            }
          }
        } catch (err) {
          totalErrors++
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setAutoImportTV(null)
    fetchStats()
  }

  // Auto-import games through all sources
  const handleAutoImportGames = async () => {
    stopGamesRef.current = false
    const sources = GAME_SOURCES

    setAutoImportGames({
      isRunning: true,
      currentSource: sources[0].label,
      sourceIndex: 0,
      totalSources: sources.length,
      currentPage: 1,
      totalPages: 1,
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
    })

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
      if (stopGamesRef.current) break

      const source = sources[sourceIdx]

      setAutoImportGames(prev => prev ? {
        ...prev,
        currentSource: source.label,
        sourceIndex: sourceIdx,
      } : null)

      try {
        const res = await fetch("/api/admin/import/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: source.value,
            limit: 500,
            skipExisting: true,
          }),
        })

        const data = await res.json()

        if (res.ok && data.stats) {
          totalImported += data.stats.imported
          totalSkipped += data.stats.skipped
          totalErrors += data.stats.errors

          setAutoImportGames(prev => prev ? {
            ...prev,
            totalImported,
            totalSkipped,
            totalErrors,
          } : null)
        }
      } catch (err) {
        totalErrors++
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setAutoImportGames(null)
    fetchStats()
  }

  const isAnyAutoRunning = autoImportMovies?.isRunning || autoImportTV?.isRunning || autoImportGames?.isRunning

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import en masse</h1>
        <p className="text-gray-600">
          Remplissez votre base de donnees avec des films et jeux depuis TMDB et IGDB.
        </p>
      </div>

      {/* Database Stats */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-3">
          <Database className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Contenu de la base de données</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Main counts */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Film className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-700">
                    {stats.counts.movies}
                  </div>
                  <div className="text-sm text-purple-600">Films</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Gamepad2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-700">
                    {stats.counts.games}
                  </div>
                  <div className="text-sm text-green-600">Jeux</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Tv className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-700">
                    {stats.counts.tv}
                  </div>
                  <div className="text-sm text-blue-600">Séries TV</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold text-orange-700">
                    {stats.counts.reviews}
                  </div>
                  <div className="text-sm text-orange-600">Avis</div>
                </div>
              </div>

              {/* Coverage stats */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Couverture des recommandations d&apos;âge
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Films</span>
                      <span className="font-medium">{stats.coverage.moviesWithAgeRec} / {stats.counts.movies}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.coverage.moviesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stats.coverage.moviesPercent}%</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Séries</span>
                      <span className="font-medium">{stats.coverage.tvWithAgeRec} / {stats.counts.tv}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.coverage.tvPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stats.coverage.tvPercent}%</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Jeux</span>
                      <span className="font-medium">{stats.coverage.gamesWithAgeRec} / {stats.counts.games}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.coverage.gamesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stats.coverage.gamesPercent}%</p>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4 text-center">
                <p className="text-gray-600">
                  <span className="font-bold text-2xl text-gray-900">{stats.counts.total}</span>
                  {" "}médias au total dans la base
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Impossible de charger les statistiques</p>
          )}
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Dernier import ({lastResult.type === "movies" ? "Films" : lastResult.type === "tv" ? "Séries" : "Jeux"})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold">{lastResult.stats.total}</div>
                <div className="text-xs text-gray-500">Traités</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">{lastResult.stats.imported}</div>
                <div className="text-xs text-green-600">Importés</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-700">{lastResult.stats.skipped}</div>
                <div className="text-xs text-blue-600">Existants</div>
              </div>
              <div className={`p-3 rounded-lg ${lastResult.stats.errors > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                <div className={`text-xl font-bold ${lastResult.stats.errors > 0 ? "text-red-700" : "text-gray-400"}`}>
                  {lastResult.stats.errors}
                </div>
                <div className={`text-xs ${lastResult.stats.errors > 0 ? "text-red-600" : "text-gray-400"}`}>Erreurs</div>
              </div>
            </div>

            {/* Error Details */}
            {lastResult.stats.errors > 0 && lastResult.stats.details && lastResult.stats.details.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700 mb-2">Détails des erreurs:</p>
                <div className="max-h-40 overflow-y-auto text-xs text-red-600 space-y-1">
                  {lastResult.stats.details
                    .filter((d) => d.startsWith("Error"))
                    .slice(0, 20)
                    .map((detail, i) => (
                      <p key={i}>{detail}</p>
                    ))}
                  {lastResult.stats.details.filter((d) => d.startsWith("Error")).length > 20 && (
                    <p className="text-red-500 font-medium">
                      ... et {lastResult.stats.details.filter((d) => d.startsWith("Error")).length - 20} autres erreurs
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Import Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Movies Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-purple-600" />
              Importer des Films (TMDB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-import progress */}
            {autoImportMovies && (
              <div className="space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-purple-700">
                    {autoImportMovies.currentSource}
                  </span>
                  <span className="text-purple-600">
                    Source {autoImportMovies.sourceIndex + 1}/{autoImportMovies.totalSources}
                  </span>
                </div>
                <Progress
                  value={(autoImportMovies.sourceIndex / autoImportMovies.totalSources) * 100}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="text-green-600">+{autoImportMovies.totalImported} importés</span>
                  <span className="text-blue-600">{autoImportMovies.totalSkipped} existants</span>
                  {autoImportMovies.totalErrors > 0 && (
                    <span className="text-red-500">{autoImportMovies.totalErrors} erreurs</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={movieSource}
                onChange={(e) => setMovieSource(e.target.value as ImportSource)}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "movies" || !!autoImportMovies}
              >
                {MOVIE_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} - {s.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de pages (20 films/page)
              </label>
              <select
                value={moviePages}
                onChange={(e) => setMoviePages(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "movies" || !!autoImportMovies}
              >
                <option value={2}>2 pages (40 films)</option>
                <option value={5}>5 pages (100 films)</option>
                <option value={10}>10 pages (200 films) - max</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleImport("movies")}
                disabled={importing !== null || isAnyAutoRunning}
                variant="outline"
                className="flex-1"
              >
                {importing === "movies" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Un lot
                  </>
                )}
              </Button>

              {autoImportMovies ? (
                <Button
                  onClick={() => stopMoviesRef.current = true}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Arrêter
                </Button>
              ) : (
                <Button
                  onClick={handleAutoImportMovies}
                  disabled={importing !== null || isAnyAutoRunning}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* TV Series Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-blue-600" />
              Importer des Séries (TMDB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-import progress */}
            {autoImportTV && (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-blue-700">
                    {autoImportTV.currentSource}
                  </span>
                  <span className="text-blue-600">
                    Source {autoImportTV.sourceIndex + 1}/{autoImportTV.totalSources}
                  </span>
                </div>
                <Progress
                  value={(autoImportTV.sourceIndex / autoImportTV.totalSources) * 100}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="text-green-600">+{autoImportTV.totalImported} importés</span>
                  <span className="text-blue-600">{autoImportTV.totalSkipped} existants</span>
                  {autoImportTV.totalErrors > 0 && (
                    <span className="text-red-500">{autoImportTV.totalErrors} erreurs</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={tvSource}
                onChange={(e) => setTvSource(e.target.value as ImportSource)}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "tv" || !!autoImportTV}
              >
                {TV_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} - {s.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de pages (20 séries/page)
              </label>
              <select
                value={tvPages}
                onChange={(e) => setTvPages(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "tv" || !!autoImportTV}
              >
                <option value={2}>2 pages (40 séries)</option>
                <option value={5}>5 pages (100 séries)</option>
                <option value={10}>10 pages (200 séries) - max</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleImport("tv")}
                disabled={importing !== null || isAnyAutoRunning}
                variant="outline"
                className="flex-1"
              >
                {importing === "tv" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Un lot
                  </>
                )}
              </Button>

              {autoImportTV ? (
                <Button
                  onClick={() => stopTVRef.current = true}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Arrêter
                </Button>
              ) : (
                <Button
                  onClick={handleAutoImportTV}
                  disabled={importing !== null || isAnyAutoRunning}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Games Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-green-600" />
              Importer des Jeux (IGDB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-import progress */}
            {autoImportGames && (
              <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-green-700">
                    {autoImportGames.currentSource}
                  </span>
                  <span className="text-green-600">
                    Source {autoImportGames.sourceIndex + 1}/{autoImportGames.totalSources}
                  </span>
                </div>
                <Progress
                  value={(autoImportGames.sourceIndex / autoImportGames.totalSources) * 100}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="text-green-600">+{autoImportGames.totalImported} importés</span>
                  <span className="text-blue-600">{autoImportGames.totalSkipped} existants</span>
                  {autoImportGames.totalErrors > 0 && (
                    <span className="text-red-500">{autoImportGames.totalErrors} erreurs</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={gameSource}
                onChange={(e) => setGameSource(e.target.value as ImportSource)}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "games" || !!autoImportGames}
              >
                {GAME_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} - {s.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nombre de jeux</label>
              <select
                value={gameLimit}
                onChange={(e) => setGameLimit(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "games" || !!autoImportGames}
              >
                <option value={50}>50 jeux</option>
                <option value={100}>100 jeux</option>
                <option value={200}>200 jeux</option>
                <option value={500}>500 jeux (max)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleImport("games")}
                disabled={importing !== null || isAnyAutoRunning}
                variant="outline"
                className="flex-1"
              >
                {importing === "games" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Un lot
                  </>
                )}
              </Button>

              {autoImportGames ? (
                <Button
                  onClick={() => stopGamesRef.current = true}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Arrêter
                </Button>
              ) : (
                <Button
                  onClick={handleAutoImportGames}
                  disabled={importing !== null || isAnyAutoRunning}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Tips */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Conseils d&apos;import</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>
              <strong>Mode Auto</strong>: Parcourt automatiquement toutes les sources (Populaires, Mieux notés, Récents, etc.) et importe le maximum de contenu.
            </li>
            <li>
              Les éléments existants sont automatiquement ignorés (basé sur l&apos;ID TMDB/IGDB).
            </li>
            <li>
              Vous pouvez arrêter l&apos;import auto à tout moment avec le bouton &quot;Arrêter&quot;.
            </li>
            <li>
              Limite de 200 films par lot (contrainte serveur). Le mode auto enchaîne plusieurs lots.
            </li>
            <li>
              Les certifications (CSA, PEGI) sont automatiquement importées quand disponibles.
            </li>
            <li>
              <strong>Objectif recommandé</strong> : 1000-2000 films pour une bonne base de départ.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
