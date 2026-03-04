"use client"

import { useEffect, useState, useMemo } from "react"
import { Gamepad2, Star, Clock, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MIN_AGE, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import type { MediaItem as MockMediaItem } from "@/lib/types"

const ITEMS_PER_PAGE = 24
const FEATURED_COUNT = 7

export default function JeuxPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    minAge: DEFAULT_MIN_AGE,
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
        // Family filter mode: use smart filter API
        if (filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0) {
          const offset = (currentPage - 1) * ITEMS_PER_PAGE
          const smartRes = await fetch("/api/filter/smart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              familyMemberIds: filters.familyMemberIds,
              mediaType: "GAME",
              limit: ITEMS_PER_PAGE,
              offset,
              strictMode: true,
              minScore: 50,
              topics: filters.topics,
              platforms: filters.platforms,
              search: filters.searchQuery || "",
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
                originalTitle: undefined,
                type: "GAME" as const,
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
                setDbGames(mapped)
                const total = smartData.total || 0
                setDbTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)))
                setDbTotalResults(total)
                setDbLoading(false)
              }
              return
            }
          }
          // Smart filter failed — fall through to normal API
        }

        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
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

        // No results from DB
        if (!cancelled) {
          setSource("db")
          setDbGames([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } catch {
        if (!cancelled) {
          setSource("db")
          setDbGames([])
          setDbTotalPages(1)
          setDbTotalResults(0)
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
  }, [currentPage, filters.minAge, filters.maxAge, filters.searchQuery, filters.platforms, filters.topics, filters.sortBy, filters.useFamilyFilter, filters.familyMemberIds])

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
    let items = dbGames

    // Apply platform filter client-side
    if (filters.platforms.length > 0) {
      items = items.filter((m) =>
        m.platforms.some((p) =>
          filters.platforms.some((fp) => p.toLowerCase().includes(fp.toLowerCase()))
        )
      )
    }

    return items
  }, [dbGames, filters.platforms])

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    return [...new Set(dbGames.map(g => g.title))]
  }, [dbGames])

  const totalPages = dbTotalPages
  const paginatedGames = filteredGames

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
            <FilterSidebar onFiltersChange={handleFiltersChange} mediaType="GAME" availableTitles={availableTitles} initialFilters={{ minAge: DEFAULT_MIN_AGE, maxAge: DEFAULT_MAX_AGE }} />
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {[...Array(FEATURED_COUNT)].map((_, i) => (
                    <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : featuredGames.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
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
              <div className={`p-1.5 rounded-lg ${filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0 ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-600"}`}>
                {filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0 ? <Users className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {filters.useFamilyFilter && filters.familyMemberIds && filters.familyMemberIds.length > 0
                  ? "Jeux adaptés à votre famille"
                  : filters.searchQuery
                    ? `Résultats pour "${filters.searchQuery}"`
                    : "Tous les jeux"}
              </h2>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
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




