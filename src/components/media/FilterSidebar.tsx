"use client"

import { useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const platforms = [
  "Netflix France",
  "Disney+",
  "Prime Video",
  "Canal+",
  "France TV",
  "Apple TV+",
]

const topics = [
  "Famille",
  "Aventure",
  "Animation",
  "Éducatif",
  "Fantastique",
  "Science-Fiction",
  "Comédie",
  "Animaux",
  "Super-héros",
  "Histoire",
]

interface FilterSidebarProps {
  className?: string
  onFiltersChange?: (filters: FilterState) => void
}

export interface FilterState {
  maxAge: number
  platforms: string[]
  topics: string[]
}

export function FilterSidebar({ className, onFiltersChange }: FilterSidebarProps) {
  const [maxAge, setMaxAge] = useState(18)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  const handleAgeChange = (value: number[]) => {
    setMaxAge(value[0])
    onFiltersChange?.({
      maxAge: value[0],
      platforms: selectedPlatforms,
      topics: selectedTopics,
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
    })
  }

  const clearFilters = () => {
    setMaxAge(18)
    setSelectedPlatforms([])
    setSelectedTopics([])
    onFiltersChange?.({
      maxAge: 18,
      platforms: [],
      topics: [],
    })
  }

  const hasFilters = maxAge < 18 || selectedPlatforms.length > 0 || selectedTopics.length > 0

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

