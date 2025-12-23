"use client"

import { useState, useEffect } from "react"
import {
  Film,
  Gamepad2,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Database,
  Loader2,
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
  movieCount?: number
  gameCount?: number
  recentMovies?: Array<{ title: string; tmdbId: number; createdAt: string }>
  recentGames?: Array<{ title: string; igdbId: number; createdAt: string }>
}

type ImportSource = "popular" | "top_rated" | "now_playing" | "family" | "animation" | "kids" | "recent"

const MOVIE_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Films les plus populaires actuellement" },
  { value: "top_rated", label: "Mieux notes", description: "Films les mieux notes de tous les temps" },
  { value: "now_playing", label: "En salles", description: "Films actuellement au cinema" },
  { value: "family", label: "Famille", description: "Films pour toute la famille" },
  { value: "animation", label: "Animation", description: "Films d'animation" },
  { value: "kids", label: "Enfants", description: "Films pour enfants (animation + famille, -12 ans)" },
]

const GAME_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "popular", label: "Populaires", description: "Jeux les plus populaires" },
  { value: "family", label: "Famille", description: "Jeux PEGI 3 et PEGI 7" },
  { value: "recent", label: "Recents", description: "Jeux sortis dans les 6 derniers mois" },
]

export default function BulkImportPage() {
  const [movieStats, setMovieStats] = useState<DbStats | null>(null)
  const [gameStats, setGameStats] = useState<DbStats | null>(null)
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
      const [moviesRes, gamesRes] = await Promise.all([
        fetch("/api/admin/import/movies"),
        fetch("/api/admin/import/games"),
      ])

      if (moviesRes.ok) {
        setMovieStats(await moviesRes.json())
      }
      if (gamesRes.ok) {
        setGameStats(await gamesRes.json())
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Statistiques de la base</CardTitle>
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
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Film className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-3xl font-bold text-purple-700">
                    {movieStats?.movieCount ?? 0}
                  </div>
                  <div className="text-sm text-purple-600">Films</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-3xl font-bold text-green-700">
                    {gameStats?.gameCount ?? 0}
                  </div>
                  <div className="text-sm text-green-600">Jeux</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Result */}
        {lastResult && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Dernier import</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total traite:</span>
                  <span className="font-medium">{lastResult.stats.total}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Importes:</span>
                  <span className="font-medium">{lastResult.stats.imported}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Ignores (existants):</span>
                  <span className="font-medium">{lastResult.stats.skipped}</span>
                </div>
                {lastResult.stats.errors > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Erreurs:</span>
                    <span className="font-medium">{lastResult.stats.errors}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
                <option value={1}>1 page (20 films)</option>
                <option value={5}>5 pages (100 films)</option>
                <option value={10}>10 pages (200 films)</option>
                <option value={20}>20 pages (400 films)</option>
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
              Les elements existants sont automatiquement ignores (base sur l&apos;ID TMDB/IGDB).
            </li>
            <li>
              Commencez par &quot;Enfants&quot; ou &quot;Famille&quot; pour un contenu adapte aux plus jeunes.
            </li>
            <li>
              L&apos;import peut prendre quelques minutes selon le nombre d&apos;elements.
            </li>
            <li>
              Les certifications (CSA, PEGI) sont automatiquement importees quand disponibles.
            </li>
            <li>
              Vous pouvez lancer plusieurs imports successifs pour enrichir votre base.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
