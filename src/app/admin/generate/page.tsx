"use client"

import { useState } from "react"
import { Sparkles, Search, Copy, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GeneratedData {
  id: string
  tmdbId: number
  title: string
  originalTitle: string
  type: string
  releaseDate: string
  posterUrl: string
  synopsisFr: string
  genres: string[]
  expertAgeRec: number
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
  }
  whatParentsNeedToKnow: string[]
}

export default function GenerateReviewPage() {
  const [tmdbId, setTmdbId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ id: number; title: string; release_date: string; poster_path: string }>>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<GeneratedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    setError(null)

    try {
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()

      if (Array.isArray(data.movies)) {
        setSearchResults(data.movies.slice(0, 6))
      }
    } catch {
      setError("Erreur lors de la recherche")
    } finally {
      setSearching(false)
    }
  }

  const handleGenerate = async (id?: number) => {
    const targetId = id || parseInt(tmdbId)
    if (!targetId) {
      setError("Veuillez entrer un ID TMDB valide")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/admin/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: targetId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la generation")
      }

      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const metricsLabels: Record<string, string> = {
    violence: "Violence",
    sexNudity: "Sexe/Nudite",
    language: "Langage",
    consumerism: "Consumerisme",
    substanceUse: "Drogues/Alcool",
    positiveMessages: "Messages positifs",
    roleModels: "Modeles positifs",
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-purple-500 rounded-xl text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Generateur de contenu</h1>
        </div>
        <p className="text-gray-600">
          Generez automatiquement des evaluations de contenu pour les films a partir de TMDB.
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Rechercher un film</h2>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Titre du film..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? "Recherche..." : "Rechercher"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => handleGenerate(movie.id)}
                  className="text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium line-clamp-1">{movie.title}</p>
                  <p className="text-sm text-gray-500">{movie.release_date?.split("-")[0]}</p>
                  <p className="text-xs text-primary mt-1">ID: {movie.id}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct ID Input */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Ou entrer un ID TMDB directement</h2>
          <div className="flex gap-2">
            <Input
              placeholder="ID TMDB (ex: 420818)"
              value={tmdbId}
              onChange={(e) => setTmdbId(e.target.value)}
              type="number"
            />
            <Button onClick={() => handleGenerate()} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Generation..." : "Generer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{result.title}</h2>
                {result.originalTitle !== result.title && (
                  <p className="text-gray-500">{result.originalTitle}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copie !" : "Copier JSON"}
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div>
                {result.posterUrl && (
                  <img
                    src={result.posterUrl}
                    alt={result.title}
                    className="w-full max-w-xs rounded-lg shadow-lg mb-4"
                  />
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500">Age recommande: {result.expertAgeRec}+</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    Sortie: {result.releaseDate}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.genres.map((g) => (
                      <Badge key={g} variant="outline">{g}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Synopsis</h3>
                  <p className="text-gray-600 text-sm">{result.synopsisFr}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Metriques de contenu</h3>
                  <div className="space-y-2">
                    {Object.entries(result.contentMetrics).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{metricsLabels[key] || key}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${
                                i <= value
                                  ? key.includes("positive") || key.includes("roleModels")
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                  : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Ce que les parents doivent savoir</h3>
                  <ul className="space-y-1">
                    {result.whatParentsNeedToKnow.map((tip, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
