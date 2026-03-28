"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Film, Clock, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MIN_AGE, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import type { MediaItem as MockMediaItem } from "@/lib/types"
import type { TransformedMediaItem } from "@/lib/media-queries"

interface ApiMediaRecord {
  id: string | number
  title?: string
  originalTitle?: string
  type?: string
  releaseDate?: string | null
  posterUrl?: string
  synopsisFr?: string | null
  officialRating?: string | null
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  contentMetrics?: MockMediaItem["contentMetrics"] | null
  reviews?: unknown[]
  reviewCount?: number
  reviewAvgRating?: number | null
  tmdbRating?: number | null
  tmdbVoteCount?: number | null
  mediaId?: string
}

const ITEMS_PER_PAGE = 24

function mapApiToMediaItem(m: ApiMediaRecord, type: "MOVIE" | "TV" | "GAME" = "MOVIE"): MockMediaItem {
  return {
    id: String(m.mediaId || m.id),
    title: String(m.title || ""),
    originalTitle: m.originalTitle ? String(m.originalTitle) : undefined,
    type,
    releaseDate: m.releaseDate ?? null,
    posterUrl: String(m.posterUrl || ""),
    synopsisFr: m.synopsisFr ?? null,
    officialRating: m.officialRating ?? null,
    expertAgeRec: m.expertAgeRec ?? null,
    communityAgeRec: m.communityAgeRec ?? null,
    genres: m.genres || [],
    platforms: m.platforms || [],
    topics: m.topics || [],
    contentMetrics: m.contentMetrics || null,
    reviews: [],
    reviewCount: m.reviewCount || 0,
    reviewAvgRating: m.reviewAvgRating ?? null,
    tmdbRating: m.tmdbRating ?? null,
    tmdbVoteCount: m.tmdbVoteCount ?? null,
  } as MockMediaItem
}

function ssrItemToMediaItem(item: TransformedMediaItem): MockMediaItem {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle ?? undefined,
    type: item.type as "MOVIE",
    releaseDate: item.releaseDate,
    posterUrl: item.posterUrl || "",
    synopsisFr: item.synopsisFr ?? null,
    officialRating: item.officialRating ?? null,
    expertAgeRec: item.expertAgeRec,
    communityAgeRec: item.communityAgeRec ?? null,
    genres: item.genres,
    platforms: item.platforms,
    topics: item.topics,
    contentMetrics: item.contentMetrics as MockMediaItem["contentMetrics"] | null,
    reviews: [],
    reviewCount: item.reviewCount || 0,
    reviewAvgRating: item.reviewAvgRating ?? null,
    tmdbRating: item.tmdbRating ?? null,
    tmdbVoteCount: item.tmdbVoteCount ?? null,
  } as MockMediaItem
}

interface ClientFilmsPageProps {
  initialData: {
    items: TransformedMediaItem[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  } | null
  initialFilters: {
    minAge: number
    maxAge: number
    topics: string[]
    platforms: string[]
    search: string
    sortBy: string
  }
  initialPage: number
  isCinema: boolean
}

export function ClientFilmsPage({ initialData, initialFilters, initialPage, isCinema }: ClientFilmsPageProps) {
  const router = useRouter()
  const isInitialMount = useRef(true)

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [filters, setFilters] = useState<FilterState>({
    minAge: initialFilters.minAge,
    maxAge: initialFilters.maxAge,
    platforms: initialFilters.platforms,
    topics: initialFilters.topics,
    searchQuery: initialFilters.search,
    sortBy: initialFilters.sortBy || undefined,
  })

  // Initialize from SSR data if available
  const [dbMovies, setDbMovies] = useState<MockMediaItem[]>(
    initialData ? initialData.items.map(ssrItemToMediaItem) : []
  )
  const [dbTotalPages, setDbTotalPages] = useState(initialData?.pagination.totalPages ?? 1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(initialData?.pagination.total ?? null)
  const [loading, setLoading] = useState(!initialData && !isCinema ? false : false)

  // Build URL params from current filter state
  const buildUrlParams = useCallback((f: FilterState, page: number) => {
    const params = new URLSearchParams()
    if (isCinema) params.set("sort", "cinema")
    if (f.minAge > DEFAULT_MIN_AGE) params.set("minAge", String(f.minAge))
    if (f.maxAge < DEFAULT_MAX_AGE) params.set("maxAge", String(f.maxAge))
    if (f.searchQuery && f.searchQuery.trim()) params.set("q", f.searchQuery.trim())
    if (f.topics.length > 0) params.set("topics", f.topics.join(","))
    if (f.platforms.length > 0) params.set("platforms", f.platforms.join(","))
    if (f.sortBy && f.sortBy !== "releaseDate") params.set("sortBy", f.sortBy)
    if (page > 1) params.set("page", String(page))
    const qs = params.toString()
    return `/films${qs ? `?${qs}` : ""}`
  }, [isCinema])

  // Fetch movies from API (client-side, for filter/page changes)
  useEffect(() => {
    // Skip initial fetch if we have SSR data and filters haven't changed
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialData) return
      if (isCinema) {
        // Cinema mode: need to fetch on mount (TMDB data not SSR'd)
      } else {
        return
      }
    }

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        // Cinema mode: use TMDB cinema API
        if (isCinema) {
          const cinemaRes = await fetch("/api/cinema", { signal: controller.signal })
          if (cinemaRes.ok) {
            const cinemaData = await cinemaRes.json()
            if (cinemaData.movies && cinemaData.movies.length > 0) {
              const mapped = cinemaData.movies.map((m: ApiMediaRecord) => mapApiToMediaItem(m, "MOVIE"))
              if (!cancelled) {
                setDbMovies(mapped)
                setDbTotalPages(1)
                setDbTotalResults(mapped.length)
                setLoading(false)
              }
              return
            }
          }
        }

        // Family filter mode: use smart filter API
        if (filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0) {
          const offset = (currentPage - 1) * ITEMS_PER_PAGE
          const smartRes = await fetch("/api/filter/smart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              familyMemberIds: filters.familyMemberIds,
              mediaType: "MOVIE",
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
              const mapped = smartData.results.map((r: ApiMediaRecord) => mapApiToMediaItem(r, "MOVIE"))
              if (!cancelled) {
                setDbMovies(mapped)
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

        // Normal DB fetch
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          requirePoster: "true",
          language: "fr,en",
        })
        if (filters.minAge > DEFAULT_MIN_AGE) dbParams.set("minAge", filters.minAge.toString())
        if (filters.maxAge < DEFAULT_MAX_AGE) dbParams.set("maxAge", filters.maxAge.toString())
        if (filters.searchQuery && filters.searchQuery.trim().length >= 2) {
          dbParams.set("q", filters.searchQuery.trim())
        }
        if (filters.platforms.length > 0) dbParams.set("platforms", filters.platforms.join(","))
        if (filters.topics.length > 0) dbParams.set("topics", filters.topics.join(","))
        if (filters.sortBy && filters.sortBy !== "releaseDate") dbParams.set("sortBy", filters.sortBy)

        const dbRes = await fetch(`/api/db/movies?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.movies && dbData.movies.length > 0) {
            const mapped = dbData.movies.map((m: ApiMediaRecord) => mapApiToMediaItem(m, "MOVIE"))
            if (!cancelled) {
              setDbMovies(mapped)
              setDbTotalPages(dbData.pagination?.totalPages || 1)
              setDbTotalResults(dbData.pagination?.total || mapped.length)
              setLoading(false)
            }
            return
          }
        }

        // No results
        if (!cancelled) {
          setDbMovies([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } catch {
        if (!cancelled) {
          setDbMovies([])
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
  }, [currentPage, filters.minAge, filters.maxAge, filters.searchQuery, filters.platforms, filters.topics, filters.sortBy, filters.useFamilyFilter, filters.familyMemberIds, isCinema, initialData])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
    // Replace URL for filter changes (don't pollute history)
    router.replace(buildUrlParams(newFilters, 1), { scroll: false })
  }, [router, buildUrlParams])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    // Push URL for pagination (back button navigates between pages)
    router.push(buildUrlParams(filters, page), { scroll: false })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [router, filters, buildUrlParams])

  const availableTitles = useMemo(() => {
    return [...new Set(dbMovies.map(m => m.title))]
  }, [dbMovies])

  const totalPages = dbTotalPages
  const totalCount = dbTotalResults ?? dbMovies.length

  // Section title
  const sectionTitle = filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0
    ? "Films adaptés à votre famille"
    : filters.searchQuery
      ? `Résultats pour "${filters.searchQuery}"`
      : isCinema
        ? "En ce moment au cinéma"
        : initialFilters.maxAge < DEFAULT_MAX_AGE
          ? `Films pour les ${initialFilters.maxAge <= 7 ? "enfants" : `${initialFilters.maxAge} ans et moins`}`
          : "Tous les films"

  const SectionIcon = filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0
    ? Users
    : Clock

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-rose-500 rounded-xl text-white">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Films</h1>
        </div>
        <p className="text-gray-600">
          Découvrez les meilleurs films pour toute la famille avec nos critiques
          et recommandations par âge.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar
              onFiltersChange={handleFiltersChange}
              mediaType="MOVIE"
              availableTitles={availableTitles}
              initialFilters={{
                minAge: initialFilters.minAge,
                maxAge: initialFilters.maxAge,
                platforms: initialFilters.platforms,
                topics: initialFilters.topics,
                searchQuery: initialFilters.search,
                sortBy: initialFilters.sortBy || undefined,
              }}
            />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0 ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-600"}`}>
                <SectionIcon className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {sectionTitle}
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              {totalCount} film{totalCount !== 1 ? "s" : ""}
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-500">
              <Film className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Récupération du catalogue</p>
            </div>
          ) : dbMovies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {dbMovies.map((item) => (
                  <MediaCard key={item.id} media={item} />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                className="mt-8"
              />
            </>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun film trouvé</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
