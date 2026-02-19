"use client"

import { useEffect, useState, useMemo } from "react"
import { Gamepad2, Database, Star, Clock } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 12
const FEATURED_COUNT = 7

export default function JeuxPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    maxAge: DEFAULT_MAX_AGE,
    platforms: [],
    topics: [],
    searchQuery: "",
  })
  const [source, setSource] = useState<"db" | "mock">("mock")
  const [dbGames, setDbGames] = useState<MockMediaItem[]>([])
  const [dbTotalPages, setDbTotalPages] = useState(1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(null)
  const [dbLoading, setDbLoading] = useState(false)

  // Featured games (high quality, separate fetch)
  const [featuredGames, setFeaturedGames] = useState<MockMediaItem[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)

  // Fetch games from local database only
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setDbLoading(true)
      try {
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
        }
        if (filters.searchQuery && filters.searchQuery.trim().length >= 2) {
          dbParams.set("q", filters.searchQuery.trim())
        }

        const dbRes = await fetch(`/api/db/games?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.games && dbData.games.length > 0) {
            const mapped: MockMediaItem[] = dbData.games.map((g: any) => ({
              id: String(g.id),
              title: String(g.title || ""),
              originalTitle: undefined,
              type: "GAME" as const,
              releaseDate: g.releaseDate ?? null,
              posterUrl: String(g.posterUrl || ""),
              synopsisFr: g.synopsisFr ?? null,
              officialRating: g.officialRating ?? null,
              expertAgeRec: g.expertAgeRec ?? null,
              communityAgeRec: g.communityAgeRec ?? null,
              genres: g.genres || [],
              platforms: g.platforms || [],
              topics: g.topics || [],
              contentMetrics: g.contentMetrics || {
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
              reviewCount: g.reviewCount || 0,
              reviewAvgRating: g.reviewAvgRating ?? null,
            }))

            if (!cancelled) {
              setSource("db")
              setDbGames(mapped)
              setDbTotalPages(dbData.pagination?.totalPages || 1)
              setDbTotalResults(dbData.pagination?.total || mapped.length)
              setDbLoading(false)
            }
            return
          }
        }

        // Fallback to mock data if database is empty
        if (!cancelled) {
          setSource("mock")
        }
      } catch {
        if (!cancelled) {
          setSource("mock")
        }
      } finally {
        if (!cancelled) setDbLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [currentPage, filters.maxAge, filters.searchQuery])

  // Fetch featured games (high quality, sorted by quality score)
  useEffect(() => {
    async function loadFeatured() {
      setFeaturedLoading(true)
      try {
        const res = await fetch(`/api/db/games?limit=${FEATURED_COUNT}&featured=true&sortBy=quality&maxAge=${filters.maxAge}`)
        if (res.ok) {
          const data = await res.json()
          if (data.games && data.games.length > 0) {
            const mapped: MockMediaItem[] = data.games.map((g: any) => ({
              id: String(g.id),
              title: String(g.title || ""),
              originalTitle: undefined,
              type: "GAME" as const,
              releaseDate: g.releaseDate ?? null,
              posterUrl: String(g.posterUrl || ""),
              synopsisFr: g.synopsisFr ?? null,
              officialRating: g.officialRating ?? null,
              expertAgeRec: g.expertAgeRec ?? null,
              communityAgeRec: g.communityAgeRec ?? null,
              genres: g.genres || [],
              platforms: g.platforms || [],
              topics: g.topics || [],
              contentMetrics: g.contentMetrics || null,
              reviews: [],
              reviewCount: g.reviewCount || 0,
              reviewAvgRating: g.reviewAvgRating ?? null,
            }))
            setFeaturedGames(mapped)
          }
        }
      } catch (error) {
        console.error("Failed to fetch featured games:", error)
      } finally {
        setFeaturedLoading(false)
      }
    }
    loadFeatured()
  }, [filters.maxAge])

  const filteredGames = useMemo(() => {
    // Use database games if available
    let items = source === "db"
      ? dbGames
      : mockMediaItems.filter((m) => m.type === "GAME")

    // For mock data, apply client-side filters
    if (source === "mock") {
      // Apply search filter
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim()
        items = items.filter((m) =>
          m.title.toLowerCase().includes(query)
        )
      }

      if (filters.maxAge < 18) {
        items = items.filter((m) => (m.expertAgeRec ?? 99) <= filters.maxAge)
      }

      if (filters.platforms.length > 0) {
        items = items.filter((m) =>
          m.platforms.some((p) =>
            filters.platforms.some((fp) => p.toLowerCase().includes(fp.toLowerCase()))
          )
        )
      }

      if (filters.topics.length > 0) {
        items = items.filter((m) =>
          m.topics.some((t) =>
            filters.topics.some((ft) => t.toLowerCase().includes(ft.toLowerCase()))
          ) ||
          m.genres.some((g) =>
            filters.topics.some((ft) => g.toLowerCase().includes(ft.toLowerCase()))
          )
        )
      }
    }

    // For DB data, also apply platform filter client-side
    if (source === "db" && filters.platforms.length > 0) {
      items = items.filter((m) =>
        m.platforms.some((p) =>
          filters.platforms.some((fp) => p.toLowerCase().includes(fp.toLowerCase()))
        )
      )
    }

    return items
  }, [dbGames, filters, source])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    const titles = source === "db"
      ? dbGames.map(g => g.title)
      : mockMediaItems.filter(m => m.type === "GAME").map(g => g.title)
    return [...new Set(titles)] // Remove duplicates
  }, [dbGames, source])

  const totalPages = source === "db" ? dbTotalPages : Math.ceil(filteredGames.length / ITEMS_PER_PAGE)
  const paginatedGames = useMemo(() => {
    if (source === "db") return filteredGames
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredGames.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredGames, currentPage, source])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-green-500 rounded-xl text-white">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Jeux Vidéo</h1>
        </div>
        <p className="text-gray-600">
          Explorez notre sélection de jeux vidéo avec classifications PEGI et avis de la communauté.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar onFiltersChange={handleFiltersChange} mediaType="GAME" availableTitles={availableTitles} />
          </div>
        </div>

        <div className="flex-1">
          {/* Featured Section - Top quality games */}
          {currentPage === 1 && !filters.searchQuery && filters.platforms.length === 0 && filters.topics.length === 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg text-white">
                  <Star className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Sélection qualité</h2>
                <span className="text-xs text-gray-500">Jeux bien notés et adaptés aux familles</span>
              </div>
              {featuredLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {[...Array(FEATURED_COUNT)].map((_, i) => (
                    <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : featuredGames.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {featuredGames.map((game) => (
                    <MediaCard key={`featured-${game.id}`} media={game} />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* All Games Section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-200 text-gray-600">
                <Clock className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {filters.searchQuery ? `Résultats pour "${filters.searchQuery}"` : "Tous les jeux"}
              </h2>
              {source === "db" && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  <Database className="h-3 w-3" /> Base locale
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {(source === "db" ? dbTotalResults ?? filteredGames.length : filteredGames.length)} jeu{(source === "db" ? dbTotalResults ?? filteredGames.length : filteredGames.length) !== 1 ? "x" : ""}
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>

          {dbLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Récupération du catalogue</p>
            </div>
          ) : paginatedGames.length > 0 ? (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {paginatedGames.map((game) => (
                  <MediaCard key={game.id} media={game} />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="mt-8"
              />
            </>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun jeu trouvé</p>
              <p className="text-sm">Essayez de modifier vos filtres ou importez plus de jeux</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}




