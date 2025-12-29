"use client"

import { useState } from "react"
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
}

export interface FilterState {
  maxAge: number
  platforms: string[]
  topics: string[]
  searchQuery?: string
}

// Default to family-friendly content (12 years) - can be increased to 18 by user
export const DEFAULT_MAX_AGE = 12

export function FilterSidebar({ className, onFiltersChange, mediaType = "MOVIE" }: FilterSidebarProps) {
  // Select appropriate platforms and topics based on media type
  const platforms = mediaType === "GAME" ? gamingPlatforms : streamingPlatforms
  const topics = mediaType === "GAME" ? gameTopics : movieTopics
  const [maxAge, setMaxAge] = useState(DEFAULT_MAX_AGE)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onFiltersChange?.({
      maxAge,
      platforms: selectedPlatforms,
      topics: selectedTopics,
      searchQuery: value,
    })
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder={mediaType === "GAME" ? "Rechercher un jeu..." : "Rechercher..."}
            className="pl-9 pr-4 bg-gray-50 border-gray-200 focus:bg-white"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
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







