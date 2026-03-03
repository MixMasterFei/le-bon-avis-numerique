"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Film, Clock, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MIN_AGE, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import type { MediaItem as MockMediaItem } from "@/lib/types"

const ITEMS_PER_PAGE = 24

export default function FilmsPage() {
  const searchParams = useSearchParams()
  const sortParam = searchParams.get("sort") // "cinema"
  const maxAgeParam = searchParams.get("maxAge")
  const isNowPlaying = sortParam === "cinema"

  // Initialize maxAge from URL param if present, otherwise use default
  const initialMaxAge = maxAgeParam ? Math.min(Math.max(parseInt(maxAgeParam) || DEFAULT_MAX_AGE, 0), 18) : DEFAULT_MAX_AGE

  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    minAge: DEFAULT_MIN_AGE,
    maxAge: initialMaxAge,
    platforms: [],
    topics: [],
    searchQuery: "",
  })
  const [source, setSource] = useState<"db" | "mock">("mock")
  const [dbMovies, setDbMovies] = useState<MockMediaItem[]>([])
  const [dbTotalPages, setDbTotalPages] = useState(1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch movies from database, smart filter API, or TMDB cinema API
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        // For cinema mode, use the TMDB-based cinema API (accurate French theater listings)
        if (isNowPlaying) {
          const cinemaRes = await fetch("/api/cinema", { signal: controller.signal })
          if (cinemaRes.ok) {
            const cinemaData = await cinemaRes.json()
            if (cinemaData.movies && cinemaData.movies.length > 0) {
              const mapped: MockMediaItem[] = cinemaData.movies.map((m: any) => ({
                id: String(m.id),
                title: String(m.title || ""),
                originalTitle: m.originalTitle ? String(m.originalTitle) : undefined,
                type: "MOVIE" as const,
                releaseDate: m.releaseDate ?? null,
                posterUrl: String(m.posterUrl || ""),
                synopsisFr: null,
                officialRating: null,
                expertAgeRec: m.expertAgeRec ?? null,
                communityAgeRec: m.communityAgeRec ?? null,
                genres: m.genres || [],
                platforms: [],
                topics: m.topics || [],
                contentMetrics: null,
                reviews: [],
              }))

              if (!cancelled) {
                setSource("db")
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
              minScore: 50,
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
                type: (r.type || "MOVIE") as "MOVIE",
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
                setDbMovies(mapped)
                const total = smartData.total || 0
                setDbTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)))
                setDbTotalResults(total)
                setLoading(false)
              }
              return
            }
          }

          // Smart filter failed (e.g. not logged in) — fall through to normal API
        }

        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          requirePoster: "true",
          language: "fr,en",
        })
        if (filters.minAge > 2) {
          dbParams.set("minAge", filters.minAge.toString())
        }
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
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
        // Pass sortBy if user selected a non-default sort
        if (filters.sortBy && filters.sortBy !== "releaseDate") {
          dbParams.set("sortBy", filters.sortBy)
        }

        const dbRes = await fetch(`/api/db/movies?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.movies && dbData.movies.length > 0) {
            const mapped: MockMediaItem[] = dbData.movies.map((m: any) => ({
              id: String(m.id),
              title: String(m.title || ""),
              originalTitle: m.originalTitle ? String(m.originalTitle) : undefined,
              type: "MOVIE" as const,
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
            }))

            if (!cancelled) {
              setSource("db")
              setDbMovies(mapped)
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
          setDbMovies([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } catch {
        if (!cancelled) {
          setSource("db")
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
  }, [currentPage, filters.minAge, filters.maxAge, filters.searchQuery, filters.platforms, filters.topics, filters.sortBy, filters.useFamilyFilter, filters.familyMemberIds, isNowPlaying])

  const filteredMovies = useMemo(() => {
    return dbMovies
  }, [dbMovies])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    return [...new Set(dbMovies.map(m => m.title))]
  }, [dbMovies])

  const totalPages = dbTotalPages
  const paginatedMovies = filteredMovies
  const totalCount = dbTotalResults ?? filteredMovies.length

  // Section title
  const sectionTitle = filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0
    ? "Films adaptés à votre famille"
    : filters.searchQuery
      ? `Résultats pour "${filters.searchQuery}"`
      : isNowPlaying
        ? "En ce moment au cinéma"
        : maxAgeParam
          ? `Films pour les ${parseInt(maxAgeParam) <= 7 ? "enfants" : `${maxAgeParam} ans et moins`}`
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
            <FilterSidebar onFiltersChange={handleFiltersChange} mediaType="MOVIE" availableTitles={availableTitles} initialFilters={{ minAge: DEFAULT_MIN_AGE, maxAge: initialMaxAge, platforms: [], topics: [], searchQuery: "" }} />
          </div>
        </div>

        <div className="flex-1">
          {/* All Movies Section */}
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
          ) : paginatedMovies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {paginatedMovies.map((item) => (
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
