"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Loader2, Film, Tv, Gamepad2, BookOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaCard } from "@/components/media/MediaCard"
import type { MediaItem as MockMediaItem } from "@/lib/types"

type MediaType = "all" | "movie" | "tv" | "game" | "book"

interface DbMediaItem {
  id: string
  tmdbId?: number | null
  igdbId?: number | null
  title: string
  originalTitle?: string | null
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  synopsisFr: string | null
  posterUrl: string | null
  releaseDate: string | null
  expertAgeRec: number | null
  communityAgeRec: number | null
  genres: string[]
  platforms: string[]
  topics: string[]
  contentMetrics?: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
  } | null
  reviewCount?: number
  reviewAvgRating?: number | null
  tmdbRating?: number | null
  tmdbVoteCount?: number | null
}

function RechercheContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<MediaType>("all")
  const [results, setResults] = useState<MockMediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [, setSource] = useState<"db" | "mock">("db")

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      // Search in local database only
      const dbRes = await fetch(`/api/db/media?q=${encodeURIComponent(searchQuery)}&limit=50`)
      if (dbRes.ok) {
        const data = await dbRes.json()
        const items: DbMediaItem[] = data.items || []

        if (items.length > 0) {
          const mapped: MockMediaItem[] = items.map((item) => ({
            id: item.id,
            title: item.title,
            originalTitle: item.originalTitle || undefined,
            type: item.type,
            posterUrl: item.posterUrl || "/placeholder-poster.jpg",
            synopsisFr: item.synopsisFr,
            releaseDate: item.releaseDate,
            expertAgeRec: item.expertAgeRec,
            communityAgeRec: item.communityAgeRec,
            officialRating: null,
            genres: item.genres || [],
            platforms: item.platforms || [],
            topics: item.topics || [],
            contentMetrics: item.contentMetrics || {
              violence: 0,
              sexNudity: 0,
              language: 0,
              consumerism: 0,
              substanceUse: 0,
              positiveMessages: 0,
              roleModels: 0,
              whatParentsNeedToKnow: [],
            },
            reviews: [],
            reviewCount: item.reviewCount || 0,
            reviewAvgRating: item.reviewAvgRating ?? null,
            tmdbRating: item.tmdbRating ?? null,
            tmdbVoteCount: item.tmdbVoteCount ?? null,
          }))
          setResults(mapped)
          setSource("db")
          return
        }
      }

      // No results from DB
      setResults([])
      setSource("db")
    } catch {
      setResults([])
      setSource("db")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery)
    }
  }, [initialQuery, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query)}`)
      performSearch(query)
    }
  }

  const filteredResults =
    activeTab === "all"
      ? results
      : results.filter((r) => r.type === activeTab.toUpperCase())

  const getCounts = () => ({
    all: results.length,
    movie: results.filter((r) => r.type === "MOVIE").length,
    tv: results.filter((r) => r.type === "TV").length,
    game: results.filter((r) => r.type === "GAME").length,
    book: results.filter((r) => r.type === "BOOK").length,
  })

  const counts = getCounts()

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Recherche</h1>

        <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Rechercher un film, une série, un jeu..."
              className="pl-11 h-12 text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Rechercher"
            )}
          </Button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Recherche en cours...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <Search className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Aucun résultat trouvé
              </h2>
              <p className="text-gray-500">
                Ce contenu n&apos;est pas encore dans notre base de données.
                <br />
                Contactez-nous pour demander son ajout !
              </p>
            </div>
          ) : (
            <>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MediaType)}>
                <TabsList className="mb-6">
                  <TabsTrigger value="all">
                    Tout ({counts.all})
                  </TabsTrigger>
                  <TabsTrigger value="movie" className="gap-1">
                    <Film className="h-4 w-4" />
                    Films ({counts.movie})
                  </TabsTrigger>
                  <TabsTrigger value="tv" className="gap-1">
                    <Tv className="h-4 w-4" />
                    Séries ({counts.tv})
                  </TabsTrigger>
                  <TabsTrigger value="game" className="gap-1">
                    <Gamepad2 className="h-4 w-4" />
                    Jeux ({counts.game})
                  </TabsTrigger>
                  <TabsTrigger value="book" className="gap-1">
                    <BookOpen className="h-4 w-4" />
                    Livres ({counts.book})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="flex items-center gap-2 mb-6">
                    <p className="text-gray-600">
                      {filteredResults.length} résultat{filteredResults.length !== 1 ? "s" : ""} pour &ldquo;{initialQuery}&rdquo;
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {filteredResults.map((result) => (
                      <MediaCard
                        key={result.id}
                        media={result}
                      />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}

      {/* Initial State */}
      {!hasSearched && (
        <div className="text-center py-16">
          <Search className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Recherchez des médias
          </h2>
          <p className="text-gray-500">
            Trouvez des films, séries, jeux et livres dans notre catalogue
          </p>
        </div>
      )}
    </div>
  )
}

export default function RecherchePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <RechercheContent />
    </Suspense>
  )
}
