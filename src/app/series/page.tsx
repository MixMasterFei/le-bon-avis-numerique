"use client"

import { useEffect, useState, useMemo } from "react"
import { Tv, Database } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 12

export default function SeriesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    maxAge: 18,
    platforms: [],
    topics: [],
  })
  const [source, setSource] = useState<"db" | "mock">("mock")
  const [dbSeries, setDbSeries] = useState<MockMediaItem[]>([])
  const [dbTotalPages, setDbTotalPages] = useState(1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

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
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
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
  }, [currentPage, filters.maxAge])

  const filteredSeries = useMemo(() => {
    // In DB mode, filtering is handled server-side
    if (source === "db") return dbSeries

    let items = mockMediaItems.filter((m) => m.type === "TV")

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

    return items
  }, [dbSeries, filters, source])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Series TV</h1>
        </div>
        <p className="text-gray-600">
          Trouvez les meilleures series adaptees a l&apos;age de vos enfants.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar onFiltersChange={handleFiltersChange} />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {source === "db" && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  <Database className="h-3 w-3" /> Base locale
                </span>
              )}
              <p className="text-gray-600">
                {totalCount} serie{totalCount !== 1 ? "s" : ""} trouvee{totalCount !== 1 ? "s" : ""}
              </p>
            </div>
            {totalPages > 1 && (
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </p>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-500">
              <Tv className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Recuperation du catalogue</p>
            </div>
          ) : paginatedSeries.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
              <p className="text-lg font-medium">Aucune serie trouvee</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



