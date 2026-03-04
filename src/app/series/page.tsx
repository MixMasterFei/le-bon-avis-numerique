"use client"

import { useEffect, useState, useMemo } from "react"
import { Tv, Star, Clock, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MIN_AGE, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import type { MediaItem as MockMediaItem } from "@/lib/types"

const ITEMS_PER_PAGE = 24
const FEATURED_COUNT = 7

export default function SeriesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    minAge: DEFAULT_MIN_AGE,
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
        // Family filter mode: use smart filter API
        if (filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0) {
          const offset = (currentPage - 1) * ITEMS_PER_PAGE
          const smartRes = await fetch("/api/filter/smart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              familyMemberIds: filters.familyMemberIds,
              mediaType: "TV",
              limit: ITEMS_PER_PAGE,
              offset,
              strictMode: true,
              minScore: 65,
              topics: filters.topics,
              platforms: filters.platforms,
              search: filters.searchQuery || "",
              requirePoster: true,
              language: "fr,en",
              ...(filters.minAge > DEFAULT_MIN_AGE ? { minAge: filters.minAge } : {}),
              ...(filters.maxAge < DEFAULT_MAX_AGE ? { maxAge: filters.maxAge } : {}),
            }),
            signal: controller.signal,
          })

          if (smartRes.ok) {
            const smartData = await smartRes.json()
            if (smartData.success && smartData.results) {
              const mapped: MockMediaItem[] = smartData.results.map((r: any) => ({
                id: String(r.mediaId),
                title: String(r.title || ""),
                originalTitle: r.originalTitle ? String(r.originalTitle) : undefined,
                type: "TV" as const,
                releaseDate: r.releaseDate ?? null,
                posterUrl: String(r.posterUrl || ""),
                synopsisFr: r.synopsisFr ?? null,
                officialRating: r.officialRating ?? null,
                expertAgeRec: r.expertAgeRec ?? null,
                communityAgeRec: null,
                genres: r.genres || [],
                platforms: r.platforms || [],
                topics: r.topics || [],
                contentMetrics: r.contentMetrics || null,
                reviews: [],
              }))

              if (!cancelled) {
                setSource("db")
                setDbSeries(mapped)
                const total = smartData.total || 0
                setDbTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)))
                setDbTotalResults(total)
                setLoading(false)
              }
              return
            }
          }
          // Smart filter failed — fall through to normal API
        }

        // Try to fetch from database
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          requirePoster: "true",
          language: "fr,en",
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
        }
        if (filters.minAge > 2) {
          dbParams.set("minAge", filters.minAge.toString())
        }
        if (filters.searchQuery && filters.searchQuery.trim().length >= 2) {
          dbParams.set("q", filters.searchQuery.trim())
        }
        if (filters.platforms.length > 0) {
          dbParams.set("platforms", filters.platforms.join(","))
        }
        if (filters.topics.length > 0) {
          dbParams.set("topics", filters.topics.join(","))
        }
        if (filters.sortBy && filters.sortBy !== "releaseDate") {
          dbParams.set("sortBy", filters.sortBy)
        }

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

        // No results from DB
        if (!cancelled) {
          setSource("db")
          setDbSeries([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } catch {
        if (!cancelled) {
          setSource("db")
          setDbSeries([])
          setDbTotalPages(1)
          setDbTotalResults(0)
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
  }, [currentPage, filters.minAge, filters.maxAge, filters.searchQuery, filters.platforms, filters.topics, filters.sortBy, filters.useFamilyFilter, filters.familyMemberIds])

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
    return dbSeries
  }, [dbSeries])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    return [...new Set(dbSeries.map(s => s.title))]
  }, [dbSeries])

  const totalPages = dbTotalPages
  const paginatedSeries = filteredSeries
  const totalCount = dbTotalResults ?? filteredSeries.length

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
            <FilterSidebar onFiltersChange={handleFiltersChange} mediaType="TV" availableTitles={availableTitles} initialFilters={{ minAge: DEFAULT_MIN_AGE, maxAge: DEFAULT_MAX_AGE }} />
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {[...Array(FEATURED_COUNT)].map((_, i) => (
                    <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : featuredSeries.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
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
              <div className={`p-1.5 rounded-lg ${filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0 ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-600"}`}>
                {filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0 ? <Users className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0
                  ? "Séries adaptées à votre famille"
                  : filters.searchQuery
                    ? `Résultats pour "${filters.searchQuery}"`
                    : "Toutes les séries"}
              </h2>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
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














