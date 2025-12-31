"use client"

import { useState } from "react"
import { Loader2, Film, Tv, Gamepad2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImportPresetsBarProps {
  onImportComplete?: () => void
}

interface Preset {
  id: string
  label: string
  icon: React.ElementType
  description: string
  endpoint: string
  params: Record<string, string | number>
}

const PRESETS: Preset[] = [
  {
    id: "movies-week",
    label: "Films de la semaine",
    icon: Film,
    description: "Films populaires sortis cette semaine",
    endpoint: "/api/admin/batch-import",
    params: { type: "MOVIE", preset: "trending_week", limit: 20 },
  },
  {
    id: "series-recent",
    label: "Séries récentes",
    icon: Tv,
    description: "Séries populaires en cours",
    endpoint: "/api/admin/batch-import",
    params: { type: "TV", preset: "popular", limit: 20 },
  },
  {
    id: "family-animation",
    label: "Animation famille",
    icon: Sparkles,
    description: "Films d'animation pour toute la famille",
    endpoint: "/api/admin/batch-import",
    params: { type: "MOVIE", preset: "family_animation", limit: 20 },
  },
  {
    id: "games-recent",
    label: "Jeux récents",
    icon: Gamepad2,
    description: "Jeux vidéo récents populaires",
    endpoint: "/api/admin/batch-import",
    params: { type: "GAME", preset: "recent", limit: 20 },
  },
]

export function ImportPresetsBar({ onImportComplete }: ImportPresetsBarProps) {
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; count?: number; error?: string }>>({})

  const handlePresetClick = async (preset: Preset) => {
    setLoadingPreset(preset.id)

    try {
      const res = await fetch(preset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset.params),
      })

      const data = await res.json()

      if (data.success) {
        setResults((prev) => ({
          ...prev,
          [preset.id]: { success: true, count: data.imported || data.count },
        }))
        onImportComplete?.()
      } else {
        setResults((prev) => ({
          ...prev,
          [preset.id]: { success: false, error: data.error },
        }))
      }
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [preset.id]: { success: false, error: "Erreur réseau" },
      }))
    } finally {
      setLoadingPreset(null)
    }
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">Import rapide par catégorie</h3>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const isLoading = loadingPreset === preset.id
          const result = results[preset.id]

          return (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handlePresetClick(preset)}
              className={
                result?.success
                  ? "border-green-500 text-green-600"
                  : result?.error
                  ? "border-red-500 text-red-600"
                  : ""
              }
              title={preset.description}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <preset.icon className="h-4 w-4 mr-1" />
              )}
              {preset.label}
              {result?.success && result.count !== undefined && (
                <span className="ml-1 text-xs">({result.count})</span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
