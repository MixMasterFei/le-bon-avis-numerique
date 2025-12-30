"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Filter, X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
  initialFilters?: FilterState // For pre-setting filters from URL
}

export interface FilterState {
  maxAge: number
  platforms: string[]
  topics: string[]
  searchQuery?: string
}

// Default to family-friendly content (12 years) - can be increased to 18 by user
export const DEFAULT_MAX_AGE = 12

export function FilterSidebar({ className, onFiltersChange, mediaType = "MOVIE", availableTitles = [], initialFilters }: FilterSidebarProps) {
  // Select appropriate platforms and topics based on media type
  const platforms = mediaType === "GAME" ? gamingPlatforms : streamingPlatforms
  const topics = mediaType === "GAME" ? gameTopics : movieTopics
  const [maxAge, setMaxAge] = useState(initialFilters?.maxAge ?? DEFAULT_MAX_AGE)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialFilters?.platforms ?? [])
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialFilters?.topics ?? [])
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery ?? "")
  const [showSuggestions, setShowSuggestions] = useState(false)
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
      maxAge,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery: value,
    })
  }

  const selectSuggestion = (title: string) => {
    setSearchQuery(title)
    setShowSuggestions(false)
    onFiltersChange?.({
      maxAge,
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
    setMaxAge(value[0])
    onFiltersChange?.({
      maxAge: value[0],
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
      maxAge,
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
      maxAge,
      platforms: selectedPlatforms,
      topics: updated,
      searchQuery,
    })
  }

  const clearFilters = () => {
    setMaxAge(DEFAULT_MAX_AGE)
    setSelectedPlatforms([])
    setSelectedTopics([])
    setSearchQuery("")
    onFiltersChange?.({
      maxAge: DEFAULT_MAX_AGE,
      platforms: [],
      topics: [],
      searchQuery: "",
    })
  }

  const hasFilters = maxAge !== DEFAULT_MAX_AGE || selectedPlatforms.length > 0 || selectedTopics.length > 0 || searchQuery.length > 0

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

      {/* Age Slider */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-700">Âge maximum</h3>
        <div className="px-2">
          <Slider
            value={[maxAge]}
            onValueChange={handleAgeChange}
            max={18}
            min={2}
            step={1}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>2 ans</span>
            <span className="font-semibold text-primary text-sm">{maxAge} ans</span>
            <span>18 ans</span>
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








