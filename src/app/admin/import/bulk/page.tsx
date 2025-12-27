"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    moviesPercent: number
    gamesPercent: number
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

const GAME_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Jeux les plus populaires" },
  { value: "family", label: "Famille", description: "Jeux PEGI 3 et PEGI 7" },
  { value: "recent", label: "Recents", description: "Jeux sortis dans les 6 derniers mois" },
]

export default function BulkImportPage() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ type: string; stats: ImportStats } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [movieSource, setMovieSource] = useState<ImportSource>("popular")
  const [moviePages, setMoviePages] = useState(5)
  const [gameSource, setGameSource] = useState<ImportSource>("popular")
  const [gameLimit, setGameLimit] = useState(100)

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

  const handleImport = async (type: "movies" | "games") => {
    setImporting(type)
    setError(null)
    setLastResult(null)

    try {
      const endpoint = `/api/admin/import/${type}`
      const body =
        type === "movies"
          ? { source: movieSource, pages: moviePages, skipExisting: true }
          : { source: gameSource, limit: gameLimit, skipExisting: true }

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
      fetchStats() // Refresh stats
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setImporting(null)
    }
  }

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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Films avec âge recommandé</span>
                      <span className="font-medium">{stats.coverage.moviesWithAgeRec} / {stats.counts.movies}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.coverage.moviesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stats.coverage.moviesPercent}% couverts</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Jeux avec âge recommandé</span>
                      <span className="font-medium">{stats.coverage.gamesWithAgeRec} / {stats.counts.games}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.coverage.gamesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stats.coverage.gamesPercent}% couverts</p>
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
            <CardTitle className="text-lg">Dernier import ({lastResult.type === "movies" ? "Films" : "Jeux"})</CardTitle>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Movies Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-purple-600" />
              Importer des Films (TMDB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={movieSource}
                onChange={(e) => setMovieSource(e.target.value as ImportSource)}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "movies"}
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
                disabled={importing === "movies"}
              >
                <option value={5}>5 pages (100 films) - ~30s</option>
                <option value={10}>10 pages (200 films) - ~1min</option>
                <option value={20}>20 pages (400 films) - ~2min</option>
                <option value={30}>30 pages (600 films) - ~3min</option>
                <option value={50}>50 pages (1000 films) - ~5min</option>
              </select>
            </div>

            <Button
              onClick={() => handleImport("movies")}
              disabled={importing !== null}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {importing === "movies" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Lancer l&apos;import
                </>
              )}
            </Button>
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
            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={gameSource}
                onChange={(e) => setGameSource(e.target.value as ImportSource)}
                className="w-full p-2 border rounded-lg"
                disabled={importing === "games"}
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
                disabled={importing === "games"}
              >
                <option value={50}>50 jeux</option>
                <option value={100}>100 jeux</option>
                <option value={200}>200 jeux</option>
                <option value={500}>500 jeux (max)</option>
              </select>
            </div>

            <Button
              onClick={() => handleImport("games")}
              disabled={importing !== null}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {importing === "games" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Lancer l&apos;import
                </>
              )}
            </Button>
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
              Les éléments existants sont automatiquement ignorés (basé sur l&apos;ID TMDB/IGDB).
            </li>
            <li>
              <strong>Pour remplir rapidement votre base</strong>, importez depuis plusieurs sources différentes :
              Populaires, Mieux notés, Récents, Films français, Classiques, etc.
            </li>
            <li>
              Commencez par &quot;Enfants&quot; ou &quot;Famille&quot; pour un contenu adapté aux plus jeunes.
            </li>
            <li>
              L&apos;import peut prendre plusieurs minutes selon le nombre d&apos;éléments (50 pages ≈ 5 min).
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
