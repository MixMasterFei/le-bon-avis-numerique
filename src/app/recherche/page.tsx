"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Loader2, Film, Tv, Gamepad2, BookOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaCard } from "@/components/media/MediaCard"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

type MediaType = "all" | "movie" | "tv" | "game" | "book"

interface SearchResult {
  id: string
  title: string
  originalTitle?: string
  synopsisFr: string | null
  posterUrl: string
  releaseDate: string | null
  rating: number | null
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
}

function RechercheContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<MediaType>("all")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      // Search in mock data first (instant results)
      const mockResults = mockMediaItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.originalTitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )

      // Transform mock data to search result format
      const transformedMock: SearchResult[] = mockResults.map((item) => ({
        id: item.id,
        title: item.title,
        originalTitle: item.originalTitle,
        synopsisFr: item.synopsisFr,
        posterUrl: item.posterUrl,
        releaseDate: item.releaseDate,
        rating: item.communityAgeRec,
        type: item.type,
      }))

      setResults(transformedMock)

      // Also search external APIs in parallel
      const apiResults: SearchResult[] = []

      try {
        const [moviesRes, gamesRes] = await Promise.allSettled([
          fetch(`/api/movies/search?q=${encodeURIComponent(searchQuery)}`),
          fetch(`/api/games/search?q=${encodeURIComponent(searchQuery)}`),
        ])

        if (moviesRes.status === "fulfilled" && moviesRes.value.ok) {
          const data = await moviesRes.value.json()
          apiResults.push(...(data.movies || []))
        }

        if (gamesRes.status === "fulfilled" && gamesRes.value.ok) {
          const data = await gamesRes.value.json()
          apiResults.push(...(data.games || []))
        }
      } catch {
        // API errors are non-fatal, continue with mock results
      }

      // Combine and deduplicate results
      const combined = [...transformedMock, ...apiResults]
      const unique = combined.filter(
        (item, index, self) =>
          index === self.findIndex((t) => t.id === item.id)
      )

      setResults(unique)
    } catch {
      // Keep showing mock results on error
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

  // Convert SearchResult to MockMediaItem format for MediaCard
  const convertToMockItem = (result: SearchResult): MockMediaItem => {
    const mockItem = mockMediaItems.find((m) => m.id === result.id)
    if (mockItem) return mockItem

    // Create a minimal mock item for API results
    return {
      id: result.id,
      title: result.title,
      originalTitle: result.originalTitle || result.title,
      type: result.type,
      posterUrl: result.posterUrl,
      synopsisFr: result.synopsisFr || "",
      releaseDate: result.releaseDate || "",
      expertAgeRec: 0,
      communityAgeRec: result.rating || 0,
      officialRating: "TOUS_PUBLICS",
      genres: [],
      platforms: [],
      topics: [],
      contentMetrics: {
        violence: 0,
        sexNudity: 0,
        language: 0,
        consumerism: 0,
        substanceUse: 0,
        positiveMessages: 3,
        roleModels: 3,
        whatParentsNeedToKnow: [],
      },
      reviews: [],
    }
  }

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
              placeholder="Rechercher un film, une serie, un jeu..."
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
                Aucun resultat trouve
              </h2>
              <p className="text-gray-500">
                Essayez avec d&apos;autres termes de recherche
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
                    Series ({counts.tv})
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
                  <p className="text-gray-600 mb-6">
                    {filteredResults.length} resultat{filteredResults.length !== 1 ? "s" : ""} pour &ldquo;{initialQuery}&rdquo;
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {filteredResults.map((result) => (
                      <MediaCard
                        key={result.id}
                        media={convertToMockItem(result)}
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
            Recherchez des medias
          </h2>
          <p className="text-gray-500">
            Trouvez des films, series, jeux et livres pour toute la famille
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
