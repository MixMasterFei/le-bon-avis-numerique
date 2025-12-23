"use client"

import { useEffect, useState, useMemo } from "react"
import { Gamepad2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 12

export default function JeuxPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    maxAge: 18,
    platforms: [],
    topics: [],
  })
  const [source, setSource] = useState<"api" | "mock">("mock")
  const [apiGames, setApiGames] = useState<MockMediaItem[]>([])
  const [apiLoading, setApiLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setApiLoading(true)
      try {
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
  }, [filters.maxAge])

  const filteredGames = useMemo(() => {
    if (source === "api") return apiGames

    let items = mockMediaItems.filter((m) => m.type === "GAME")

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
  }, [apiGames, filters, source])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE)
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredGames.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredGames, currentPage])

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
            <FilterSidebar onFiltersChange={handleFiltersChange} />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              {filteredGames.length} jeu{filteredGames.length !== 1 ? "x" : ""} trouve{filteredGames.length !== 1 ? "s" : ""}
              {source === "api" && " (IGDB)"}
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </p>
            )}
          </div>

          {apiLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium">Chargement...</p>
              <p className="text-sm">Recuperation du catalogue</p>
            </div>
          ) : paginatedGames.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
