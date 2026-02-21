"use client"

import { useEffect, useState, useMemo } from "react"
import { Tv, Star, Clock } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 24
const FEATURED_COUNT = 7

export default function SeriesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    maxAge: DEFAULT_MAX_AGE,
    platforms: [],
    topics: [],
    searchQuery: "",
  })
  const [source, setSource] = useState<"db" | "mock">("mock")
  const [dbSeries, setDbSeries] = useState<MockMediaItem[]>([])
  const [dbTotalPages, setDbTotalPages] = useState(1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Featured series (high quality, separate fetch)
  const [featuredSeries, setFeaturedSeries] = useState<MockMediaItem[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)

  // Priority: 1. Database, 2. Mock data
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        // Try to fetch from database
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          requirePoster: "true",
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
        }
        // Filter to French/English content only (relevant for French audience)
        dbParams.set("language", "fr,en")

        const dbRes = await fetch(`/api/db/series?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.series && dbData.series.length > 0) {
            const mapped: MockMediaItem[] = dbData.series.map((s: any) => ({
              id: String(s.id),
              title: String(s.title || ""),
              originalTitle: s.originalTitle ? String(s.originalTitle) : undefined,
              type: "TV" as const,
              releaseDate: s.releaseDate ?? null,
              posterUrl: String(s.posterUrl || ""),
              synopsisFr: s.synopsisFr ?? null,
              officialRating: s.officialRating ?? null,
              expertAgeRec: s.expertAgeRec ?? null,
              communityAgeRec: s.communityAgeRec ?? null,
              genres: s.genres || [],
              platforms: s.platforms || [],
              topics: s.topics || [],
              contentMetrics: s.contentMetrics || null,
              reviews: [],
              reviewCount: s.reviewCount || 0,
              reviewAvgRating: s.reviewAvgRating ?? null,
              tmdbRating: s.tmdbRating ?? null,
              tmdbVoteCount: s.tmdbVoteCount ?? null,
            }))

            if (!cancelled) {
              setSource("db")
              setDbSeries(mapped)
              setDbTotalPages(dbData.pagination?.totalPages || 1)
              setDbTotalResults(dbData.pagination?.total || mapped.length)
              setLoading(false)
            }
            return
          }
        }

        // Fallback to mock data
        if (!cancelled) {
          setSource("mock")
        }
      } catch {
        if (!cancelled) {
          setSource("mock")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [currentPage, filters.maxAge, filters.searchQuery, filters.platforms, filters.topics])

  // Fetch featured series (high quality, sorted by quality score)
  useEffect(() => {
    async function loadFeatured() {
      setFeaturedLoading(true)
      try {
        const res = await fetch(`/api/db/series?limit=${FEATURED_COUNT}&featured=true&sortBy=quality&maxAge=${filters.maxAge}`)
        if (res.ok) {
          const data = await res.json()
          if (data.series && data.series.length > 0) {
            const mapped: MockMediaItem[] = data.series.map((s: any) => ({
              id: String(s.id),
              title: String(s.title || ""),
              originalTitle: s.originalTitle ? String(s.originalTitle) : undefined,
              type: "TV" as const,
              releaseDate: s.releaseDate ?? null,
              posterUrl: String(s.posterUrl || ""),
              synopsisFr: s.synopsisFr ?? null,
              officialRating: s.officialRating ?? null,
              expertAgeRec: s.expertAgeRec ?? null,
              communityAgeRec: s.communityAgeRec ?? null,
              genres: s.genres || [],
              platforms: s.platforms || [],
              topics: s.topics || [],
              contentMetrics: s.contentMetrics || null,
              reviews: [],
              reviewCount: s.reviewCount || 0,
              reviewAvgRating: s.reviewAvgRating ?? null,
              tmdbRating: s.tmdbRating ?? null,
              tmdbVoteCount: s.tmdbVoteCount ?? null,
            }))
            setFeaturedSeries(mapped)
          }
        }
      } catch (error) {
        console.error("Failed to fetch featured series:", error)
      } finally {
        setFeaturedLoading(false)
      }
    }
    loadFeatured()
  }, [filters.maxAge])

  const filteredSeries = useMemo(() => {
    // Start with appropriate source
    let items = source === "db"
      ? dbSeries
      : mockMediaItems.filter((m) => m.type === "TV")

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

    return items
  }, [dbSeries, filters, source])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    const titles = source === "db"
      ? dbSeries.map(s => s.title)
      : mockMediaItems.filter(m => m.type === "TV").map(s => s.title)
    return [...new Set(titles)] // Remove duplicates
  }, [dbSeries, source])

  const totalPages = source === "db" ? dbTotalPages : Math.ceil(filteredSeries.length / ITEMS_PER_PAGE)
  const paginatedSeries = useMemo(() => {
    if (source === "db") return filteredSeries
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredSeries.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredSeries, currentPage, source])

  const totalCount = source === "db" ? (dbTotalResults ?? filteredSeries.length) : filteredSeries.length

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-500 rounded-xl text-white">
            <Tv className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Séries TV</h1>
        </div>
        <p className="text-gray-600">
          Trouvez les meilleures séries adaptées à l&apos;âge de vos enfants.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar onFiltersChange={handleFiltersChange} mediaType="TV" availableTitles={availableTitles} />
          </div>
        </div>

        <div className="flex-1">
          {/* Featured Section - Top quality series */}
          {currentPage === 1 && !filters.searchQuery && filters.platforms.length === 0 && filters.topics.length === 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg text-white">
                  <Star className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Sélection qualité</h2>
                <span className="text-xs text-gray-500">Séries bien notées et adaptées aux familles</span>
              </div>
              {featuredLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {[...Array(FEATURED_COUNT)].map((_, i) => (
                    <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : featuredSeries.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {featuredSeries.map((series) => (
                    <MediaCard key={`featured-${series.id}`} media={series} />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* All Series Section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-200 rounded-lg text-gray-600">
                <Clock className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Toutes les séries</h2>
            </div>
            <p className="text-sm text-gray-500">
              {totalCount} série{totalCount !== 1 ? "s" : ""}
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-500">
              <Tv className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Récupération du catalogue</p>
            </div>
          ) : paginatedSeries.length > 0 ? (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {paginatedSeries.map((item) => (
                  <MediaCard key={item.id} media={item} />
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
              <Tv className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune série trouvée</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}














