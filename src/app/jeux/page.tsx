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
  const [source, setSource] = useState<"db" | "api" | "mock">("mock")
  const [apiGames, setApiGames] = useState<MockMediaItem[]>([])
  const [apiTotalPages, setApiTotalPages] = useState(1)
  const [apiTotalResults, setApiTotalResults] = useState<number | null>(null)
  const [apiLoading, setApiLoading] = useState(false)

  // Featured games (high quality, separate fetch)
  const [featuredGames, setFeaturedGames] = useState<MockMediaItem[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)

  // Priority: 1. Database, 2. External API, 3. Mock data
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setApiLoading(true)
      try {
        // First, try to fetch from database
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
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
            }))

            if (!cancelled) {
              setSource("db")
              setApiGames(mapped)
              setApiTotalPages(dbData.pagination?.totalPages || 1)
              setApiTotalResults(dbData.pagination?.total || mapped.length)
              setApiLoading(false)
            }
            return
          }
        }

        // Fallback to external API if database is empty
        const endpoint = filters.maxAge <= 12 ? "/api/games/family" : "/api/games/popular"
        const res = await fetch(endpoint, { signal: controller.signal })
        if (!res.ok) {
          setSource("mock")
          return
        }
        const data = await res.json()
        const games = Array.isArray(data?.games) ? data.games : []

        if (games.length === 0) {
          setSource("mock")
          return
        }

        const mapped: MockMediaItem[] = games.map((g: Record<string, unknown>) => ({
          id: String(g.id),
          title: String(g.title || ""),
          originalTitle: undefined,
          type: "GAME" as const,
          releaseDate: g.releaseDate ? String(g.releaseDate) : null,
          posterUrl: String(g.posterUrl || ""),
          synopsisFr: g.synopsisFr ? String(g.synopsisFr) : null,
          officialRating: g.officialRating ? String(g.officialRating) : null,
          expertAgeRec: typeof g.expertAgeRec === "number" ? g.expertAgeRec : null,
          communityAgeRec: typeof g.rating === "number" ? g.rating : null,
          genres: Array.isArray(g.genres) ? g.genres.map(String) : [],
          platforms: Array.isArray(g.platforms) ? g.platforms.map(String) : [],
          topics: [],
          contentMetrics: {
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
        }))

        if (!cancelled) {
          setSource("api")
          setApiGames(mapped)
          setApiTotalPages(1)
          setApiTotalResults(mapped.length)
        }
      } catch {
        if (!cancelled) {
          setSource("mock")
        }
      } finally {
        if (!cancelled) setApiLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [currentPage, filters.maxAge])

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
    // Start with appropriate source
    let items = (source === "db" || source === "api")
      ? apiGames
      : mockMediaItems.filter((m) => m.type === "GAME")

    // Apply search filter (client-side for all sources)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      items = items.filter((m) =>
        m.title.toLowerCase().includes(query)
      )
    }

    // For mock data, apply additional filters
    if (source === "mock") {
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

    // For DB/API data, also apply platform filter client-side
    if ((source === "db" || source === "api") && filters.platforms.length > 0) {
      items = items.filter((m) =>
        m.platforms.some((p) =>
          filters.platforms.some((fp) => p.toLowerCase().includes(fp.toLowerCase()))
        )
      )
    }

    return items
  }, [apiGames, filters, source])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    const titles = (source === "db" || source === "api")
      ? apiGames.map(g => g.title)
      : mockMediaItems.filter(m => m.type === "GAME").map(g => g.title)
    return [...new Set(titles)] // Remove duplicates
  }, [apiGames, source])

  const totalPages = (source === "db" || source === "api") ? apiTotalPages : Math.ceil(filteredGames.length / ITEMS_PER_PAGE)
  const paginatedGames = useMemo(() => {
    if (source === "db" || source === "api") return filteredGames
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
          <h1 className="text-3xl font-bold text-gray-900">Jeux Video</h1>
        </div>
        <p className="text-gray-600">
          Explorez notre selection de jeux video avec classifications PEGI et avis de la communaute.
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
                <h2 className="text-lg font-bold text-gray-900">Selection qualite</h2>
                <span className="text-xs text-gray-500">Jeux bien notes et adaptes aux familles</span>
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
              <div className="p-1.5 bg-gray-200 rounded-lg text-gray-600">
                <Clock className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tous les jeux</h2>
              {source === "db" && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  <Database className="h-3 w-3" /> Base locale
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {((source === "db" || source === "api") ? apiTotalResults ?? filteredGames.length : filteredGames.length)} jeu
              {((source === "db" || source === "api") ? apiTotalResults ?? filteredGames.length : filteredGames.length) !== 1 ? "x" : ""}
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>

          {apiLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Recuperation du catalogue</p>
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
              <p className="text-lg font-medium">Aucun jeu trouve</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}








