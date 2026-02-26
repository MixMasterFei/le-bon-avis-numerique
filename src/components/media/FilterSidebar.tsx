"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Filter, X, Search, Users, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
}

// Streaming platforms for movies/TV
const streamingPlatforms = [
  "Netflix France",
  "Disney+",
  "Prime Video",
  "Canal+",
  "France TV",
  "Apple TV+",
]

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
const gameTopics = [
  "Aventure",
  "Action",
  "RPG",
  "Plateforme",
  "Puzzle",
  "Sport",
  "Course",
  "Simulation",
  "Éducatif",
  "Famille",
  "Multijoueur",
  "Coopératif",
]

export type MediaType = "MOVIE" | "TV" | "GAME"

interface FilterSidebarProps {
  className?: string
  onFiltersChange?: (filters: FilterState) => void
  mediaType?: MediaType
  availableTitles?: string[] // For autocomplete suggestions
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

export function FilterSidebar({ className, onFiltersChange, mediaType = "MOVIE", availableTitles = [], initialFilters }: FilterSidebarProps) {
  const { data: session } = useSession()
  // Select appropriate platforms and topics based on media type
  const platforms = mediaType === "GAME" ? gamingPlatforms : streamingPlatforms
  const topics = mediaType === "GAME" ? gameTopics : movieTopics
  const [minAge, setMinAge] = useState(initialFilters?.minAge ?? DEFAULT_MIN_AGE)
  const [maxAge, setMaxAge] = useState(initialFilters?.maxAge ?? DEFAULT_MAX_AGE)
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy ?? "releaseDate")
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

  // Load family members when user is logged in
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      if (!session?.user) return
      setLoadingFamily(true)
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
  }, [session])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Compute suggestions based on search query
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const query = searchQuery.toLowerCase().trim()
    return availableTitles
      .filter(title => title.toLowerCase().includes(query))
      .slice(0, 8) // Limit to 8 suggestions
  }, [searchQuery, availableTitles])

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
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery: value,
    })
  }

  const selectSuggestion = (title: string) => {
    setSearchQuery(title)
    setShowSuggestions(false)
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery: title,
    })
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
    onFiltersChange?.({
      minAge: value[0],
      maxAge: value[1],
      sortBy,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery,
    })
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy: value,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery,
    })
  }

  const togglePlatform = (platform: string) => {
    const updated = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform]
    setSelectedPlatforms(updated)
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy,
      platforms: updated,
      topics: selectedTopics,
      searchQuery,
    })
  }

  const toggleTopic = (topic: string) => {
    const updated = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic]
    setSelectedTopics(updated)
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy,
      platforms: selectedPlatforms,
      topics: updated,
      searchQuery,
    })
  }

  const toggleFamilyMember = (memberId: string) => {
    const updated = selectedFamilyMembers.includes(memberId)
      ? selectedFamilyMembers.filter((id) => id !== memberId)
      : [...selectedFamilyMembers, memberId]
    setSelectedFamilyMembers(updated)
    onFiltersChange?.({
      minAge,
      maxAge,
      sortBy,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery,
      familyMemberIds: updated,
      useFamilyFilter: useFamilyFilter && updated.length > 0,
    })
  }

  const toggleFamilyFilter = (enabled: boolean) => {
    setUseFamilyFilter(enabled)
    if (enabled && selectedFamilyMembers.length === 0 && familyMembers.length > 0) {
      const allIds = familyMembers.map(m => m.id)
      setSelectedFamilyMembers(allIds)
      onFiltersChange?.({
        minAge,
        maxAge,
        sortBy,
        platforms: selectedPlatforms,
        topics: selectedTopics,
        searchQuery,
        familyMemberIds: allIds,
        useFamilyFilter: true,
      })
    } else {
      onFiltersChange?.({
        minAge,
        maxAge,
        sortBy,
        platforms: selectedPlatforms,
        topics: selectedTopics,
        searchQuery,
        familyMemberIds: enabled ? selectedFamilyMembers : [],
        useFamilyFilter: enabled,
      })
    }
  }

  const clearFilters = () => {
    setMinAge(DEFAULT_MIN_AGE)
    setMaxAge(DEFAULT_MAX_AGE)
    setSortBy("releaseDate")
    setSelectedPlatforms([])
    setSelectedTopics([])
    setSearchQuery("")
    setUseFamilyFilter(false)
    setSelectedFamilyMembers([])
    onFiltersChange?.({
      minAge: DEFAULT_MIN_AGE,
      maxAge: DEFAULT_MAX_AGE,
      sortBy: "releaseDate",
      platforms: [],
      topics: [],
      searchQuery: "",
      familyMemberIds: [],
      useFamilyFilter: false,
    })
  }

  const hasFilters = minAge !== DEFAULT_MIN_AGE || maxAge !== DEFAULT_MAX_AGE || sortBy !== "releaseDate" || selectedPlatforms.length > 0 || selectedTopics.length > 0 || searchQuery.length > 0 || useFamilyFilter

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
        <div className="space-y-3 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
          <button
            onClick={() => setShowFamilySection(!showFamilySection)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Filtrer pour ma famille</span>
              {useFamilyFilter && (
                <Badge variant="default" className="text-xs bg-primary">
                  Actif
                </Badge>
              )}
            </div>
            {showFamilySection ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {showFamilySection && (
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={useFamilyFilter}
                  onCheckedChange={(checked) => toggleFamilyFilter(Boolean(checked))}
                />
                <span className="text-sm">
                  Adapter aux préférences de la famille
                </span>
              </label>

              {useFamilyFilter && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Sélectionner les membres :</p>
                  <div className="flex flex-wrap gap-2">
                    {familyMembers.map((member) => {
                      const isSelected = selectedFamilyMembers.includes(member.id)
                      const age = member.birthYear
                        ? new Date().getFullYear() - member.birthYear
                        : null
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleFamilyMember(member.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-sm transition-all",
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-white border border-gray-200 hover:border-primary"
                          )}
                        >
                          <span>{member.avatarEmoji}</span>
                          <span>{member.name}</span>
                          {age && (
                            <span className={cn(
                              "text-xs",
                              isSelected ? "text-white/80" : "text-gray-400"
                            )}>
                              ({age}a)
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Age Range Slider */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-700">Tranche d&apos;âge</h3>
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
















