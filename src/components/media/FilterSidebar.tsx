"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Filter, X, Search, Users, ChevronDown, ChevronUp, ArrowUpDown, Sparkles, Info } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { getAgeCategory, getMemberAge } from "@/lib/age-utils"
import { FILTERABLE_PLATFORMS } from "@/lib/streaming-providers"
import { GAME_GENRE_TOPICS } from "@/lib/igdb-genres"

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  useCustomSettings: boolean
  favoriteGenres: string[]
  interests: string[]
  _count?: { reactions: number }
}

// Quick profile completeness (lightweight version of CompletionMeter)
function getQuickCompleteness(member: FamilyMember): { percent: number; color: string } {
  let percent = 0
  if (member.birthYear) percent += 20
  if (member.useCustomSettings && member.favoriteGenres.length > 0) percent += 40
  if ((member._count?.reactions ?? 0) >= 3) percent += 20
  if (member.interests.length > 0) percent += 20
  const color = percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-gray-300"
  return { percent, color }
}

// Streaming platforms for movies/TV.
// Streaming platforms offered for movies/séries — sourced from the single
// canonical list so the UI matches exactly what the importer/cron store in
// MediaItem.platforms[] (e.g. "Netflix", not "Netflix France"), and so new
// providers (Arte, Max, Paramount+…) appear here automatically.
const streamingPlatforms = [...FILTERABLE_PLATFORMS]

// Gaming platforms (modern consoles only)
const gamingPlatforms = [
  "Switch",
  "PS5",
  "PS4",
  "Xbox Series",
  "Xbox One",
  "PC",
  "Mac",
]

// Topics for movies/TV
const movieTopics = [
  // Genres populaires
  "Animation",
  "Aventure",
  "Comédie",
  "Fantastique",
  "Science-Fiction",
  // Thèmes famille
  "Famille",
  "Éducatif",
  "Animaux",
  "Super-héros",
  // Thèmes spécifiques
  "Aviation",
  "Espace",
  "Magie",
  "Nature",
  "Sport",
  "Musique",
  "Histoire",
  "Amitié",
]

// Topics/themes for games
// Game genre filter labels — sourced from the single canonical French list
// so they exactly match the normalized stored genres (see igdb-genres.ts).
// (Modes/themes like Famille/Multijoueur dropped: not IGDB genres → never
// matched; the PEGI age filter covers family fit.)
const gameTopics = GAME_GENRE_TOPICS

export type MediaType = "MOVIE" | "TV" | "GAME"

interface FilterSidebarProps {
  className?: string
  onFiltersChange?: (filters: FilterState) => void
  mediaType?: MediaType
  initialFilters?: Partial<FilterState> // For pre-setting filters from URL
}

export interface FilterState {
  minAge: number
  maxAge: number
  sortBy?: string
  platforms: string[]
  topics: string[]
  searchQuery?: string
  familyMemberIds?: string[]
  useFamilyFilter?: boolean
}

export const DEFAULT_MIN_AGE = 2
export const DEFAULT_MAX_AGE = 18

export function FilterSidebar({ className, onFiltersChange, mediaType = "MOVIE", initialFilters }: FilterSidebarProps) {
  const { data: session } = useSession()
  // Select appropriate platforms and topics based on media type
  const platforms = mediaType === "GAME" ? gamingPlatforms : streamingPlatforms
  const topics = mediaType === "GAME" ? gameTopics : movieTopics
  const [minAge, setMinAge] = useState(initialFilters?.minAge ?? DEFAULT_MIN_AGE)
  const [maxAge, setMaxAge] = useState(initialFilters?.maxAge ?? DEFAULT_MAX_AGE)
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy ?? (mediaType === "GAME" ? "popularity" : "releaseDate"))
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialFilters?.platforms ?? [])
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialFilters?.topics ?? [])
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery ?? "")
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Family filter state
  const [useFamilyFilter, setUseFamilyFilter] = useState(initialFilters?.useFamilyFilter ?? false)
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<string[]>(initialFilters?.familyMemberIds ?? [])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [loadingFamily, setLoadingFamily] = useState(false)
  const [showFamilySection, setShowFamilySection] = useState(false)
  const [ageAutoAdjusted, setAgeAutoAdjusted] = useState(false)

  // Load family members when user is logged in
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      if (!session?.user) return
      queueMicrotask(() => setLoadingFamily(true))
      try {
        const res = await fetch("/api/user/family")
        if (res.ok) {
          const data = await res.json()
          setFamilyMembers(data.familyMembers || [])
        }
      } catch (err) {
        console.error("Failed to load family members:", err)
      } finally {
        setLoadingFamily(false)
      }
    }
    fetchFamilyMembers()
  }, [session?.user, session?.user?.id])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Helper to build current filter state
  const buildFilterState = (overrides: Partial<FilterState> = {}): FilterState => ({
    minAge,
    maxAge,
    sortBy,
    platforms: selectedPlatforms,
    topics: selectedTopics,
    searchQuery,
    familyMemberIds: selectedFamilyMembers,
    useFamilyFilter,
    ...overrides,
  })

  // Compute selected members with ages (sorted youngest first)
  const selectedMembersWithAge = useMemo(() => {
    return selectedFamilyMembers
      .map(id => familyMembers.find(m => m.id === id))
      .filter((m): m is FamilyMember => !!m)
      .map(m => ({ ...m, age: getMemberAge(m.birthYear, m.birthMonth) }))
      .sort((a, b) => {
        if (a.age === null && b.age === null) return 0
        if (a.age === null) return 1
        if (b.age === null) return -1
        return a.age - b.age
      })
  }, [selectedFamilyMembers, familyMembers])

  // Summary text for active filter
  const filterSummary = useMemo(() => {
    if (selectedMembersWithAge.length === 0) return null
    if (selectedMembersWithAge.length === familyMembers.length) {
      const youngest = selectedMembersWithAge[0]
      if (youngest.age !== null) {
        return `Adapté pour toute la famille (dès ${youngest.age} ans)`
      }
      return "Adapté pour toute la famille"
    }
    if (selectedMembersWithAge.length === 1) {
      const m = selectedMembersWithAge[0]
      if (m.age !== null) {
        return `Adapté pour ${m.name} (${m.age} ans)`
      }
      return `Filtré par les préférences de ${m.name}`
    }
    const youngest = selectedMembersWithAge[0]
    const others = selectedMembersWithAge.slice(1).map(m => m.name)
    if (youngest.age !== null) {
      return `Adapté pour ${youngest.name} (${youngest.age} ans) + ${others.join(", ")}`
    }
    return `Filtré pour ${selectedMembersWithAge.map(m => m.name).join(", ")}`
  }, [selectedMembersWithAge, familyMembers.length])

  // Catalogue-wide suggestions: debounced fetch to /api/autocomplete (NOT
  // just the current page of results). Mirrors HeroSearch — 200ms debounce +
  // abort the in-flight request when the query changes so stale results never
  // land. Titles only (the dropdown shows + fills the search box).
  const [suggestions, setSuggestions] = useState<string[]>([])
  const suggestAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      suggestAbortRef.current?.abort()
      const ctrl = new AbortController()
      suggestAbortRef.current = ctrl
      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(q)}&type=${mediaType}`,
          { signal: ctrl.signal },
        )
        if (!res.ok) return
        const data = await res.json()
        const titles: string[] = Array.isArray(data.suggestions)
          ? [...new Set((data.suggestions as Array<{ title: string }>).map((s) => s.title))]
          : []
        setSuggestions(titles)
      } catch {
        /* aborted or network error — keep last suggestions */
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, mediaType])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowSuggestions(value.length >= 2)
    setSelectedSuggestionIndex(-1)
    onFiltersChange?.(buildFilterState({ searchQuery: value }))
  }

  const selectSuggestion = (title: string) => {
    setSearchQuery(title)
    setShowSuggestions(false)
    onFiltersChange?.(buildFilterState({ searchQuery: title }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedSuggestionIndex])
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const handleAgeChange = (value: number[]) => {
    setMinAge(value[0])
    setMaxAge(value[1])
    setAgeAutoAdjusted(false) // User manually adjusted
    onFiltersChange?.(buildFilterState({ minAge: value[0], maxAge: value[1] }))
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    onFiltersChange?.(buildFilterState({ sortBy: value }))
  }

  const togglePlatform = (platform: string) => {
    const updated = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform]
    setSelectedPlatforms(updated)
    onFiltersChange?.(buildFilterState({ platforms: updated }))
  }

  const toggleTopic = (topic: string) => {
    const updated = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic]
    setSelectedTopics(updated)
    onFiltersChange?.(buildFilterState({ topics: updated }))
  }

  // Toggle a single family member (auto-enables filter)
  const toggleFamilyMember = (memberId: string) => {
    const updated = selectedFamilyMembers.includes(memberId)
      ? selectedFamilyMembers.filter((id) => id !== memberId)
      : [...selectedFamilyMembers, memberId]
    setSelectedFamilyMembers(updated)
    const isActive = updated.length > 0
    setUseFamilyFilter(isActive)

    // Auto-adjust age slider based on youngest selected member
    if (isActive) {
      const selectedAges = updated
        .map(id => familyMembers.find(m => m.id === id))
        .filter((m): m is FamilyMember => !!m)
        .map(m => getMemberAge(m.birthYear, m.birthMonth))
        .filter((a): a is number => a !== null)
      if (selectedAges.length > 0) {
        const youngest = Math.min(...selectedAges)
        const autoMax = Math.min(youngest, DEFAULT_MAX_AGE)
        setMaxAge(autoMax)
        setMinAge(DEFAULT_MIN_AGE)
        setAgeAutoAdjusted(true)
        onFiltersChange?.(buildFilterState({
          familyMemberIds: updated,
          useFamilyFilter: true,
          minAge: DEFAULT_MIN_AGE,
          maxAge: autoMax,
        }))
        return
      }
    } else {
      // Reset age when filter deactivated
      setMaxAge(DEFAULT_MAX_AGE)
      setMinAge(DEFAULT_MIN_AGE)
      setAgeAutoAdjusted(false)
    }

    onFiltersChange?.(buildFilterState({
      familyMemberIds: updated,
      useFamilyFilter: isActive,
      ...(isActive ? {} : { minAge: DEFAULT_MIN_AGE, maxAge: DEFAULT_MAX_AGE }),
    }))
  }

  // Toggle all family members
  const toggleAllFamily = () => {
    const allSelected = selectedFamilyMembers.length === familyMembers.length
    if (allSelected) {
      // Deselect all
      setSelectedFamilyMembers([])
      setUseFamilyFilter(false)
      setMaxAge(DEFAULT_MAX_AGE)
      setMinAge(DEFAULT_MIN_AGE)
      setAgeAutoAdjusted(false)
      onFiltersChange?.(buildFilterState({
        familyMemberIds: [],
        useFamilyFilter: false,
        minAge: DEFAULT_MIN_AGE,
        maxAge: DEFAULT_MAX_AGE,
      }))
    } else {
      // Select all
      const allIds = familyMembers.map(m => m.id)
      setSelectedFamilyMembers(allIds)
      setUseFamilyFilter(true)

      const ages = familyMembers
        .map(m => getMemberAge(m.birthYear, m.birthMonth))
        .filter((a): a is number => a !== null)
      if (ages.length > 0) {
        const youngest = Math.min(...ages)
        const autoMax = Math.min(youngest, DEFAULT_MAX_AGE)
        setMaxAge(autoMax)
        setMinAge(DEFAULT_MIN_AGE)
        setAgeAutoAdjusted(true)
        onFiltersChange?.(buildFilterState({
          familyMemberIds: allIds,
          useFamilyFilter: true,
          minAge: DEFAULT_MIN_AGE,
          maxAge: autoMax,
        }))
      } else {
        onFiltersChange?.(buildFilterState({
          familyMemberIds: allIds,
          useFamilyFilter: true,
        }))
      }
    }
  }

  const defaultSort = mediaType === "GAME" ? "popularity" : "releaseDate"

  const clearFilters = () => {
    setMinAge(DEFAULT_MIN_AGE)
    setMaxAge(DEFAULT_MAX_AGE)
    setSortBy(defaultSort)
    setSelectedPlatforms([])
    setSelectedTopics([])
    setSearchQuery("")
    setUseFamilyFilter(false)
    setSelectedFamilyMembers([])
    setAgeAutoAdjusted(false)
    onFiltersChange?.({
      minAge: DEFAULT_MIN_AGE,
      maxAge: DEFAULT_MAX_AGE,
      sortBy: defaultSort,
      platforms: [],
      topics: [],
      searchQuery: "",
      familyMemberIds: [],
      useFamilyFilter: false,
    })
  }

  const hasFilters = minAge !== DEFAULT_MIN_AGE || maxAge !== DEFAULT_MAX_AGE || sortBy !== defaultSort || selectedPlatforms.length > 0 || selectedTopics.length > 0 || searchQuery.length > 0 || useFamilyFilter

  return (
    <aside className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900">
          <Filter className="h-5 w-5" />
          Filtres
        </h2>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Search within category */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder={mediaType === "GAME" ? "Rechercher un jeu..." : "Rechercher..."}
            className="pl-9 pr-4 bg-gray-50 border-gray-200 focus:bg-white"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
          />
          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
            >
              {suggestions.map((title, index) => {
                // Highlight matching text
                const query = searchQuery.toLowerCase()
                const titleLower = title.toLowerCase()
                const matchIndex = titleLower.indexOf(query)

                return (
                  <button
                    key={title}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors",
                      index === selectedSuggestionIndex && "bg-primary/10 text-primary",
                      index === 0 && "rounded-t-lg",
                      index === suggestions.length - 1 && "rounded-b-lg"
                    )}
                    onClick={() => selectSuggestion(title)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  >
                    {matchIndex >= 0 ? (
                      <>
                        {title.slice(0, matchIndex)}
                        <span className="font-semibold text-primary">
                          {title.slice(matchIndex, matchIndex + query.length)}
                        </span>
                        {title.slice(matchIndex + query.length)}
                      </>
                    ) : (
                      title
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm text-gray-700 flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Trier par
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            ...(mediaType === "GAME" ? [{ value: "popularity", label: "Populaires" }] : []),
            { value: "releaseDate", label: "Récents" },
            { value: "title", label: "Titre A-Z" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-colors border",
                sortBy === option.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Family Filter - Only show for logged in users with family members */}
      {session?.user && familyMembers.length > 0 && (
        <div className={cn(
          "rounded-xl border overflow-hidden transition-colors",
          useFamilyFilter
            ? "bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 border-violet-200"
            : "bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20"
        )}>
          {/* Header */}
          <button
            onClick={() => setShowFamilySection(!showFamilySection)}
            className="flex items-center justify-between w-full px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium text-sm text-gray-700 truncate">Ma famille</span>
              {useFamilyFilter && (
                <Sparkles className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              )}
            </div>
            {showFamilySection ? (
              <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
          </button>

          {/* Expanded content */}
          {showFamilySection && (
            <div className="px-3 pb-3 space-y-2">
              {/* "Toute la famille" toggle */}
              <button
                onClick={toggleAllFamily}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border transition-all text-left",
                  selectedFamilyMembers.length === familyMembers.length
                    ? "bg-primary/10 border-primary/30"
                    : "bg-white/60 border-gray-200/80 hover:border-primary/30 hover:bg-white"
                )}
              >
                <Checkbox
                  checked={selectedFamilyMembers.length === familyMembers.length}
                  className="pointer-events-none"
                />
                <span className="text-xs font-medium text-gray-700">Tous ({familyMembers.length})</span>
              </button>

              {/* Individual members */}
              {familyMembers.map((member) => {
                const isSelected = selectedFamilyMembers.includes(member.id)
                const age = getMemberAge(member.birthYear, member.birthMonth)
                const category = age !== null ? getAgeCategory(age) : null
                const isChild = age !== null && age < 18
                const completeness = getQuickCompleteness(member)

                return (
                  <button
                    key={member.id}
                    onClick={() => toggleFamilyMember(member.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border transition-all text-left",
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "bg-white/60 border-gray-200/80 hover:border-primary/30 hover:bg-white"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none flex-shrink-0"
                    />
                    <MemberAvatar
                      avatarStyle={member.avatarStyle ?? null}
                      avatarSeed={member.avatarSeed ?? null}
                      avatarOptions={member.avatarOptions ?? null}
                      avatarEmoji={member.avatarEmoji ?? null}
                      name={member.name}
                      size={24}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-800 truncate">{member.name}</span>
                        {age !== null && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {isChild ? `${age}a` : "Adulte"}
                          </span>
                        )}
                        {isChild && category && (
                          <span className={cn(
                            "text-[10px] font-medium px-1 rounded-full flex-shrink-0 leading-tight",
                            category.bgColor, category.color
                          )}>
                            {category.label}
                          </span>
                        )}
                      </div>
                      {/* Mini completion bar — only for children */}
                      {isChild && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
                            <div
                              className={cn("h-full rounded-full transition-all", completeness.color)}
                              style={{ width: `${completeness.percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{completeness.percent}%</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Filter summary */}
              {filterSummary && useFamilyFilter && (
                <div className="flex items-start gap-2 px-2 py-2 bg-violet-50/80 rounded-lg mt-1">
                  <Info className="h-3.5 w-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-700 leading-relaxed">{filterSummary}</p>
                </div>
              )}

              {/* Low completeness hint */}
              {useFamilyFilter && selectedMembersWithAge.length > 0 && selectedMembersWithAge.some(m => {
                const c = getQuickCompleteness(m)
                return c.percent < 40
              }) && (
                <p className="text-[10px] text-gray-400 px-2 italic">
                  Complétez les profils pour des recommandations plus précises
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading family members indicator */}
      {session?.user && loadingFamily && familyMembers.length === 0 && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      )}

      {/* Age Range Slider */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          Tranche d&apos;age
          {ageAutoAdjusted && (
            <span className="text-[10px] font-normal text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">
              auto
            </span>
          )}
        </h3>
        <div className="px-2">
          <Slider
            value={[minAge, maxAge]}
            onValueChange={handleAgeChange}
            max={18}
            min={2}
            step={1}
            minStepsBetweenThumbs={1}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="font-semibold text-primary text-sm">{minAge} ans</span>
            <span className="font-semibold text-primary text-sm">{maxAge} ans</span>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Plateformes</h3>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <Badge
              key={platform}
              variant={selectedPlatforms.includes(platform) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedPlatforms.includes(platform)
                  ? "bg-primary hover:bg-primary/90"
                  : "hover:bg-gray-100"
              )}
              onClick={() => togglePlatform(platform)}
            >
              {platform}
            </Badge>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Thèmes</h3>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <Badge
              key={topic}
              variant={selectedTopics.includes(topic) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedTopics.includes(topic)
                  ? "bg-primary hover:bg-primary/90"
                  : "hover:bg-gray-100"
              )}
              onClick={() => toggleTopic(topic)}
            >
              {topic}
            </Badge>
          ))}
        </div>
      </div>
    </aside>
  )
}
