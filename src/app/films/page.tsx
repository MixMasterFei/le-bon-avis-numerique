"use client"

import { useEffect, useMemo, useState } from "react"
import { Film } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 12

export default function FilmsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    maxAge: 18,
    platforms: [],
    topics: [],
  })
  const [source, setSource] = useState<"api" | "mock">("mock")
  const [apiMovies, setApiMovies] = useState<MockMediaItem[]>([])
  const [apiTotalPages, setApiTotalPages] = useState(1)
  const [apiTotalResults, setApiTotalResults] = useState<number | null>(null)
  const [apiLoading, setApiLoading] = useState(false)

  // Fetch a larger catalog from TMDB when configured.
  // If API keys are missing, we keep demo/mock mode.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setApiLoading(true)
      try {
        const endpoint = filters.maxAge <= 12 ? "/api/movies/family" : "/api/movies/popular"
        const res = await fetch(`${endpoint}?page=${currentPage}`, { signal: controller.signal })
        if (!res.ok) {
          setSource("mock")
          return
        }
        const data = await res.json()
        const movies = Array.isArray(data?.movies) ? data.movies : []
        const mapped: MockMediaItem[] = movies.map((m: any) => ({
          id: String(m.id),
          title: String(m.title || ""),
          originalTitle: m.originalTitle ? String(m.originalTitle) : undefined,
          type: "MOVIE",
          releaseDate: m.releaseDate ?? null,
          posterUrl: String(m.posterUrl || ""),
          synopsisFr: m.synopsisFr ?? null,
          officialRating: null,
          expertAgeRec: null,
          communityAgeRec: m.rating ?? null,
          genres: [],
          platforms: [],
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
          setApiMovies(mapped)
          setApiTotalPages(Math.max(1, Number(data?.totalPages) || 1))
          setApiTotalResults(typeof data?.totalResults === "number" ? data.totalResults : null)
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

  const filteredMovies = useMemo(() => {
    // In API mode, filtering is handled server-side (popular vs family).
    if (source === "api") return apiMovies

    let items = mockMediaItems.filter((m) => m.type === "MOVIE")

    // Filter by age
    if (filters.maxAge < 18) {
      items = items.filter((m) => (m.expertAgeRec ?? 99) <= filters.maxAge)
    }

    // Filter by platform
    if (filters.platforms.length > 0) {
      items = items.filter((m) =>
        m.platforms.some((p) =>
          filters.platforms.some((fp) => p.toLowerCase().includes(fp.toLowerCase()))
        )
      )
    }

    // Filter by topics
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

    return items
  }, [apiMovies, filters, source])

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Pagination
  const totalPages = source === "api" ? apiTotalPages : Math.ceil(filteredMovies.length / ITEMS_PER_PAGE)
  const paginatedMovies = useMemo(() => {
    if (source === "api") return filteredMovies
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredMovies.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredMovies, currentPage, source])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-red-500 rounded-xl text-white">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Films</h1>
        </div>
        <p className="text-gray-600">
          Decouvrez les meilleurs films pour toute la famille avec nos critiques et recommandations par age.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar onFiltersChange={handleFiltersChange} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              {(source === "api" ? apiTotalResults ?? filteredMovies.length : filteredMovies.length)} film
              {(source === "api" ? apiTotalResults ?? filteredMovies.length : filteredMovies.length) !== 1 ? "s" : ""}{" "}
              trouve{(source === "api" ? apiTotalResults ?? filteredMovies.length : filteredMovies.length) !== 1 ? "s" : ""}
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </p>
            )}
          </div>

          {apiLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Récupération du catalogue</p>
            </div>
          ) : paginatedMovies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {paginatedMovies.map((movie) => (
                  <MediaCard key={movie.id} media={movie} />
                ))}
              </div>

              {/* Pagination */}
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
              <p className="text-lg font-medium">Aucun film trouve</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

