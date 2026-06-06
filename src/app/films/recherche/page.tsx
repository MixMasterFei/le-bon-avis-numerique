"use client"

import { Suspense, useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Film, ArrowLeft, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState, DEFAULT_MIN_AGE, DEFAULT_MAX_AGE } from "@/components/media/FilterSidebar"
import { Pagination } from "@/components/ui/pagination"
import type { MediaItem as MockMediaItem } from "@/lib/types"

const ITEMS_PER_PAGE = 24

function FilmsRechercheContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Parse URL params for initial state
  const initialMaxAge = searchParams.get("maxAge") ? parseInt(searchParams.get("maxAge")!) : DEFAULT_MAX_AGE
  const initialTopics = searchParams.get("topics")?.split(",").filter(Boolean) || []
  const initialGenres = searchParams.get("genres")?.split(",").filter(Boolean) || []
  const initialPlatforms = searchParams.get("platforms")?.split(",").filter(Boolean) || []
  const initialSearch = searchParams.get("q") || ""
  // ?members= deep-link parity with /films: pre-select the family members so
  // "Adapter à" filtering is active on load.
  const initialMembers = searchParams.get("members")?.split(",").filter(Boolean) || []
  const initialMinQuality = useMemo(() => searchParams.get("minQuality") ? parseInt(searchParams.get("minQuality")!) : undefined, [searchParams])
  const initialSortBy = useMemo(() => searchParams.get("sortBy") || undefined, [searchParams])
  const initialExcludeGenres = useMemo(() => searchParams.get("excludeGenres")?.split(",").filter(Boolean) || [], [searchParams])
  const initialRequirePoster = useMemo(() => searchParams.get("requirePoster") === "true", [searchParams])
  // Content-metric caps (0-5 scale). Read from URL and forward to the API.
  // Values preserved verbatim through filter interactions so chip-driven
  // safety caps don't silently drop when the user tweaks the sidebar.
  const initialMaxViolence = useMemo(() => searchParams.get("maxViolence"), [searchParams])
  const initialMaxSexual = useMemo(() => searchParams.get("maxSexual"), [searchParams])
  const initialMaxLanguage = useMemo(() => searchParams.get("maxLanguage"), [searchParams])
  const initialMaxSubstance = useMemo(() => searchParams.get("maxSubstance"), [searchParams])
  const initialMaxConsumerism = useMemo(() => searchParams.get("maxConsumerism"), [searchParams])
  // Merge genres into topics for filtering (they work the same way in the API)
  const mergedTopics = [...new Set([...initialTopics, ...initialGenres])]

  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    minAge: DEFAULT_MIN_AGE,
    maxAge: initialMaxAge,
    platforms: initialPlatforms,
    topics: mergedTopics,
    searchQuery: initialSearch,
    familyMemberIds: initialMembers,
    useFamilyFilter: initialMembers.length > 0,
  })
  const [source, setSource] = useState<"db" | "api" | "mock">("mock")
  const [apiMovies, setApiMovies] = useState<MockMediaItem[]>([])
  const [apiTotalPages, setApiTotalPages] = useState(1)
  const [apiTotalResults, setApiTotalResults] = useState<number | null>(null)
  const [apiLoading, setApiLoading] = useState(false)

  // Update URL when filters change, preserving sort/quality params
  const updateUrl = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams()
    if (newFilters.maxAge < 18) {
      params.set("maxAge", newFilters.maxAge.toString())
    }
    if (newFilters.topics.length > 0) {
      params.set("topics", newFilters.topics.join(","))
    }
    if (newFilters.platforms.length > 0) {
      params.set("platforms", newFilters.platforms.join(","))
    }
    if (newFilters.searchQuery) {
      params.set("q", newFilters.searchQuery)
    }
    if (newFilters.useFamilyFilter && newFilters.familyMemberIds?.length) {
      params.set("members", newFilters.familyMemberIds.join(","))
    }
    // Preserve sort/quality params from the original URL
    if (initialSortBy) {
      params.set("sortBy", initialSortBy)
    }
    if (initialRequirePoster) {
      params.set("requirePoster", "true")
    }
    if (initialMinQuality) {
      params.set("minQuality", initialMinQuality.toString())
    }
    if (initialExcludeGenres.length > 0) {
      params.set("excludeGenres", initialExcludeGenres.join(","))
    }
    if (initialMaxViolence) params.set("maxViolence", initialMaxViolence)
    if (initialMaxSexual) params.set("maxSexual", initialMaxSexual)
    if (initialMaxLanguage) params.set("maxLanguage", initialMaxLanguage)
    if (initialMaxSubstance) params.set("maxSubstance", initialMaxSubstance)
    if (initialMaxConsumerism) params.set("maxConsumerism", initialMaxConsumerism)
    const newUrl = params.toString() ? `/films/recherche?${params}` : "/films/recherche"
    router.replace(newUrl, { scroll: false })
  }, [router, initialSortBy, initialRequirePoster, initialMinQuality, initialExcludeGenres, initialMaxViolence, initialMaxSexual, initialMaxLanguage, initialMaxSubstance, initialMaxConsumerism])

  // Priority: 1. Database, 2. External API, 3. Mock data
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      queueMicrotask(() => setApiLoading(true))
      try {
        // "Adapter à [membre]" → per-member smart filtering (expert-only: it
        // scores on ContentMetrics, so provisional films are excluded). Server
        // derives the age band from the members' ages when no maxAge is set.
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
              ...(filters.maxAge < 18 ? { maxAge: filters.maxAge } : {}),
            }),
            signal: controller.signal,
          })
          if (smartRes.ok) {
            const smartData = await smartRes.json()
            if (smartData.success && Array.isArray(smartData.results)) {
              const zeros = { violence: 0, sexNudity: 0, language: 0, consumerism: 0, substanceUse: 0, positiveMessages: 0, roleModels: 0, whatParentsNeedToKnow: [] }
              const mapped: MockMediaItem[] = smartData.results.map((r: Record<string, unknown>) => ({
                id: String(r.mediaId),
                title: String(r.title || ""),
                originalTitle: r.originalTitle ? String(r.originalTitle) : undefined,
                type: "MOVIE",
                releaseDate: (r.releaseDate as string) ?? null,
                posterUrl: String(r.posterUrl || ""),
                synopsisFr: (r.synopsisFr as string) ?? null,
                officialRating: (r.officialRating as string) ?? null,
                expertAgeRec: (r.expertAgeRec as number) ?? null,
                communityAgeRec: null,
                genres: (r.genres as string[]) || [],
                platforms: (r.platforms as string[]) || [],
                topics: (r.topics as string[]) || [],
                contentMetrics: (r.contentMetrics as MockMediaItem["contentMetrics"]) || zeros,
                reviews: [],
                reviewCount: 0,
                reviewAvgRating: null,
                tmdbRating: null,
                tmdbVoteCount: null,
              }))
              if (!cancelled) {
                setSource("db")
                setApiMovies(mapped)
                const total = smartData.total || 0
                setApiTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)))
                setApiTotalResults(total)
                setApiLoading(false)
              }
              return
            }
          }
          // Smart filter failed — fall through to the normal DB fetch below.
        }

        // First, try to fetch from database
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        })
        if (filters.maxAge < 18) {
          dbParams.set("maxAge", filters.maxAge.toString())
        }
        if (filters.platforms.length > 0) {
          dbParams.set("platforms", filters.platforms.join(","))
        }
        if (filters.topics.length > 0) {
          dbParams.set("topics", filters.topics.join(","))
        }
        if (filters.searchQuery) {
          dbParams.set("q", filters.searchQuery)
        }
        // Pass quality and sort filters from URL params (filter sortBy takes priority)
        if (initialMinQuality) {
          dbParams.set("minQuality", initialMinQuality.toString())
        }
        if (filters.sortBy && filters.sortBy !== "releaseDate") {
          dbParams.set("sortBy", filters.sortBy)
        } else if (initialSortBy) {
          dbParams.set("sortBy", initialSortBy)
        }
        if (initialExcludeGenres.length > 0) {
          dbParams.set("excludeGenres", initialExcludeGenres.join(","))
        }
        if (initialRequirePoster) {
          dbParams.set("requirePoster", "true")
        }
        if (initialMaxViolence) dbParams.set("maxViolence", initialMaxViolence)
        if (initialMaxSexual) dbParams.set("maxSexual", initialMaxSexual)
        if (initialMaxLanguage) dbParams.set("maxLanguage", initialMaxLanguage)
        if (initialMaxSubstance) dbParams.set("maxSubstance", initialMaxSubstance)
        if (initialMaxConsumerism) dbParams.set("maxConsumerism", initialMaxConsumerism)
        // Search is an in-scope surface for provisional (imported, not-yet-enriched) films.
        dbParams.set("includeProvisional", "1")

        const dbRes = await fetch(`/api/db/movies?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.movies && dbData.movies.length > 0) {
            const mapped: MockMediaItem[] = dbData.movies.map((m: Record<string, unknown>) => ({
              id: String(m.id),
              title: String(m.title || ""),
              originalTitle: m.originalTitle ? String(m.originalTitle) : undefined,
              type: "MOVIE",
              releaseDate: m.releaseDate ?? null,
              posterUrl: String(m.posterUrl || ""),
              synopsisFr: m.synopsisFr ?? null,
              officialRating: m.officialRating ?? null,
              expertAgeRec: m.expertAgeRec ?? null,
              communityAgeRec: m.communityAgeRec ?? null,
              genres: m.genres || [],
              platforms: m.platforms || [],
              topics: m.topics || [],
              contentMetrics: m.contentMetrics || {
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
              reviewCount: m.reviewCount || 0,
              reviewAvgRating: m.reviewAvgRating ?? null,
              tmdbRating: m.tmdbRating ?? null,
              tmdbVoteCount: m.tmdbVoteCount ?? null,
              isProvisional: (m.isProvisional as boolean | undefined) ?? undefined,
            }))

            if (!cancelled) {
              setSource("db")
              setApiMovies(mapped)
              setApiTotalPages(dbData.pagination?.totalPages || 1)
              setApiTotalResults(dbData.pagination?.total || mapped.length)
              setApiLoading(false)
            }
            return
          }
        }

        // Fallback to external API if database is empty
        const endpoint = filters.maxAge <= 12 ? "/api/movies/family" : "/api/movies/popular"
        const res = await fetch(`${endpoint}?page=${currentPage}`, { signal: controller.signal })
        if (!res.ok) {
          setSource("db")
          setApiMovies([])
          setApiTotalPages(1)
          setApiTotalResults(0)
          return
        }
        const data = await res.json()
        const movies = Array.isArray(data?.movies) ? data.movies : []
        const mapped: MockMediaItem[] = movies.map((m: Record<string, unknown>) => ({
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
          reviewCount: m.reviewCount || 0,
          reviewAvgRating: m.reviewAvgRating ?? null,
          tmdbRating: m.tmdbRating ?? null,
          tmdbVoteCount: m.tmdbVoteCount ?? null,
        }))

        if (!cancelled) {
          setSource("api")
          setApiMovies(mapped)
          setApiTotalPages(Math.max(1, Number(data?.totalPages) || 1))
          setApiTotalResults(typeof data?.totalResults === "number" ? data.totalResults : null)
        }
      } catch {
        if (!cancelled) {
          setSource("db")
          setApiMovies([])
          setApiTotalPages(1)
          setApiTotalResults(0)
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
  }, [currentPage, filters.maxAge, filters.platforms, filters.topics, filters.searchQuery, filters.sortBy, filters.useFamilyFilter, filters.familyMemberIds, initialExcludeGenres, initialMinQuality, initialRequirePoster, initialSortBy, initialMaxViolence, initialMaxSexual, initialMaxLanguage, initialMaxSubstance, initialMaxConsumerism])

  const filteredMovies = useMemo(() => {
    return apiMovies
  }, [apiMovies])

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
    updateUrl(newFilters)
  }

  // Clear all filters
  const clearFilters = () => {
    const cleared: FilterState = {
      minAge: DEFAULT_MIN_AGE,
      maxAge: DEFAULT_MAX_AGE,
      platforms: [],
      topics: [],
      searchQuery: "",
    }
    setFilters(cleared)
    setCurrentPage(1)
    router.replace("/films/recherche", { scroll: false })
  }

  // Get all available titles for autocomplete
  const availableTitles = useMemo(() => {
    return [...new Set(apiMovies.map(m => m.title))]
  }, [apiMovies])

  // Pagination
  const totalPages = apiTotalPages
  const paginatedMovies = filteredMovies

  // Check if any filters are active
  const hasActiveFilters = filters.maxAge < 18 || filters.platforms.length > 0 || filters.topics.length > 0 || filters.searchQuery !== "" || !!filters.useFamilyFilter

  // Generate dynamic page title based on active filters
  const getPageTitle = () => {
    if (filters.topics.length > 0) {
      // Show the selected topics/genres as the title
      return `Films - ${filters.topics.join(", ")}`
    }
    if (filters.platforms.length > 0) {
      return `Films sur ${filters.platforms.join(", ")}`
    }
    if (filters.searchQuery) {
      return `Recherche: "${filters.searchQuery}"`
    }
    if (filters.maxAge <= 7) {
      return "Films pour enfants"
    }
    if (filters.maxAge < 12) {
      return `Films pour les ${filters.maxAge} ans et moins`
    }
    return "Rechercher des films"
  }

  const getPageSubtitle = () => {
    if (filters.topics.length > 0 || filters.platforms.length > 0) {
      return "Films correspondant à vos critères"
    }
    if (filters.maxAge <= 7) {
      return "Adaptés aux plus jeunes, analysés pour chaque âge"
    }
    if (filters.maxAge < 12) {
      return `Films adaptés aux enfants de ${filters.maxAge} ans et moins`
    }
    return "Utilisez les filtres pour trouver les films adaptés à votre famille."
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/films">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-red-500 rounded-xl text-white">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
        </div>
        <p className="text-gray-600">
          {getPageSubtitle()}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar
              onFiltersChange={handleFiltersChange}
              mediaType="MOVIE"
              availableTitles={availableTitles}
              initialFilters={filters}
            />
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full mt-4"
              >
                <X className="h-4 w-4 mr-2" />
                Effacer les filtres
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <p className="text-gray-600">
                {((source === "db" || source === "api") ? apiTotalResults ?? filteredMovies.length : filteredMovies.length)} film
                {((source === "db" || source === "api") ? apiTotalResults ?? filteredMovies.length : filteredMovies.length) !== 1 ? "s" : ""}{" "}
                trouvé{((source === "db" || source === "api") ? apiTotalResults ?? filteredMovies.length : filteredMovies.length) !== 1 ? "s" : ""}
              </p>
            </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
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
              <p className="text-lg font-medium">Aucun film trouvé</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Effacer les filtres
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function FilmsRechercheLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gray-200 rounded-xl w-12 h-12 animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-5 w-96 bg-gray-100 rounded animate-pulse mt-2" />
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="space-y-6">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-20 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {[...Array(21)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FilmsRecherchePage() {
  return (
    <Suspense fallback={<FilmsRechercheLoading />}>
      <FilmsRechercheContent />
    </Suspense>
  )
}
