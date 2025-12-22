"use client"

import { useState } from "react"
import Image from "next/image"
import { Search, Plus, Check, Film, Tv, Gamepad2, BookOpen, Loader2, AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MediaResult {
  id: string
  title: string
  originalTitle?: string
  synopsisFr: string | null
  posterUrl: string
  releaseDate: string | null
  rating: number | null
  type: "MOVIE" | "TV" | "GAME" | "BOOK"
  officialRating?: string | null
  author?: string | null
  developer?: string | null
}

type MediaType = "movie" | "tv" | "game" | "book"

const mediaTypeConfig = {
  movie: {
    icon: Film,
    label: "Films",
    searchEndpoint: "/api/movies/search",
    popularEndpoint: "/api/movies/popular",
    familyEndpoint: "/api/movies/family",
    resultKey: "movies",
    color: "bg-red-500",
  },
  tv: {
    icon: Tv,
    label: "Séries TV",
    searchEndpoint: "/api/tv/search",
    popularEndpoint: null,
    familyEndpoint: null,
    resultKey: "shows",
    color: "bg-blue-500",
  },
  game: {
    icon: Gamepad2,
    label: "Jeux",
    searchEndpoint: "/api/games/search",
    popularEndpoint: "/api/games/popular",
    familyEndpoint: "/api/games/family",
    resultKey: "games",
    color: "bg-green-500",
  },
  book: {
    icon: BookOpen,
    label: "Livres",
    searchEndpoint: "/api/books/search",
    popularEndpoint: null,
    familyEndpoint: "/api/books/children",
    resultKey: "books",
    color: "bg-amber-500",
  },
}

export default function ImportPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<MediaType>("movie")
  const [results, setResults] = useState<MediaResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())

  const config = mediaTypeConfig[searchType]

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = `${config.searchEndpoint}?q=${encodeURIComponent(searchQuery)}`
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors de la recherche")
      }
      
      const data = await response.json()
      setResults(data[config.resultKey] || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const loadPopular = async () => {
    if (!config.popularEndpoint) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(config.popularEndpoint)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors du chargement")
      }
      
      const data = await response.json()
      setResults(data[config.resultKey] || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  const loadFamily = async () => {
    if (!config.familyEndpoint) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(config.familyEndpoint)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors du chargement")
      }
      
      const data = await response.json()
      setResults(data[config.resultKey] || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (item: MediaResult) => {
    // In a real app, this would save to your database
    setImported((prev) => new Set(prev).add(item.id))
    
    // Here you would call your API to save to database:
    // await fetch('/api/media/import', {
    //   method: 'POST',
    //   body: JSON.stringify(item)
    // })
  }

  const getApiKeyName = () => {
    switch (searchType) {
      case "movie":
      case "tv":
        return "TMDB_API_KEY"
      case "game":
        return "IGDB_CLIENT_ID & IGDB_CLIENT_SECRET"
      case "book":
        return "GOOGLE_BOOKS_API_KEY"
    }
  }

  const getApiKeyLink = () => {
    switch (searchType) {
      case "movie":
      case "tv":
        return "https://www.themoviedb.org/settings/api"
      case "game":
        return "https://dev.twitch.tv/console"
      case "book":
        return "https://console.cloud.google.com/"
    }
  }

  const Icon = config.icon

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Importer du contenu
          </h1>
          <p className="text-gray-600">
            Recherchez et importez des films, séries, jeux et livres depuis les bases de données externes.
          </p>
        </div>

        {/* API Sources Info */}
        <Card className="mb-6 bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <h3 className="font-medium text-blue-900 mb-2">Sources de données</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span>Films & Séries → TMDB</span>
              </div>
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <span>Jeux → IGDB (Twitch)</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>Livres → Google Books</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Key Warning */}
        {error?.includes("not configured") && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Configuration requise</p>
                <p className="text-sm text-amber-700 mt-1">
                  Ajoutez vos clés API dans les variables d&apos;environnement :
                </p>
                <code className="block mt-2 text-xs bg-amber-100 p-2 rounded">
                  {getApiKeyName()}
                </code>
                <a
                  href={getApiKeyLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-amber-800 hover:underline mt-2"
                >
                  Obtenir une clé API
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <Tabs
              value={searchType}
              onValueChange={(v) => {
                setSearchType(v as MediaType)
                setResults([])
                setError(null)
              }}
            >
              <TabsList className="mb-4 w-full justify-start">
                {Object.entries(mediaTypeConfig).map(([key, cfg]) => (
                  <TabsTrigger key={key} value={key} className="gap-2">
                    <cfg.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="search"
                    placeholder={`Rechercher ${config.label.toLowerCase()}...`}
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Rechercher"
                  )}
                </Button>
              </div>
            </Tabs>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {config.popularEndpoint && (
                <Button variant="outline" size="sm" onClick={loadPopular} disabled={loading}>
                  Populaires
                </Button>
              )}
              {config.familyEndpoint && (
                <Button variant="outline" size="sm" onClick={loadFamily} disabled={loading}>
                  {searchType === "book" ? "Jeunesse" : "Famille"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && !error.includes("not configured") && (
          <div className="text-center py-8 text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-gray-600">Recherche en cours...</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {results.length} résultat{results.length > 1 ? "s" : ""} trouvé
              {results.length > 1 ? "s" : ""}
            </p>

            {results.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex">
                  {/* Poster */}
                  <div className="relative w-24 sm:w-32 shrink-0 aspect-[2/3] bg-gray-100">
                    {item.posterUrl && !item.posterUrl.includes("placeholder") ? (
                      <Image
                        src={item.posterUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <Icon className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.title}
                        </h3>
                        {item.originalTitle && item.originalTitle !== item.title && (
                          <p className="text-sm text-gray-500">
                            {item.originalTitle}
                          </p>
                        )}
                        {item.author && (
                          <p className="text-sm text-gray-500">par {item.author}</p>
                        )}
                        {item.developer && (
                          <p className="text-sm text-gray-500">par {item.developer}</p>
                        )}
                      </div>
                      <Badge className={config.color + " text-white"}>
                        {config.label.replace("s", "")}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mt-2 line-clamp-2 flex-1">
                      {item.synopsisFr || "Aucune description disponible"}
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {item.releaseDate && (
                          <span>{new Date(item.releaseDate).getFullYear()}</span>
                        )}
                        {item.rating !== null && item.rating > 0 && (
                          <span>★ {item.rating.toFixed(1)}</span>
                        )}
                        {item.officialRating && (
                          <Badge variant="outline" className="text-xs">
                            {item.officialRating.replace("_", " ")}
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={imported.has(item.id) ? "secondary" : "default"}
                        onClick={() => handleImport(item)}
                        disabled={imported.has(item.id)}
                      >
                        {imported.has(item.id) ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Importé
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Importer
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && results.length === 0 && searchQuery && (
          <div className="text-center py-12 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun résultat trouvé pour &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}

        {/* Initial State */}
        {!loading && !error && results.length === 0 && !searchQuery && (
          <div className="text-center py-12 text-gray-500">
            <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Recherchez {config.label.toLowerCase()} à importer</p>
            <p className="text-sm mt-1">
              ou utilisez les boutons d&apos;accès rapide ci-dessus
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
