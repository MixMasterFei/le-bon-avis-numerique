"use client"

import { useState } from "react"
import { Loader2, Film, Tv, Gamepad2, Sparkles, Library, CalendarClock, Baby } from "lucide-react"
import { Button } from "@/components/ui/button"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface ImportPresetsBarProps {
  onImportComplete?: () => void
  embedded?: boolean
}

interface Preset {
  id: string
  label: string
  icon: React.ElementType
  description: string
  endpoint: string
  params: Record<string, string | number>
  /**
   * If set, the preset walks TMDB pages: each click advances a page
   * cursor by `params.pages` so repeated clicks dig DEEPER into the
   * catalogue instead of re-fetching page 1. Used for the young-kids
   * backfill, where the page count must stay small to respect the 60s
   * serverless limit (titles are mostly new → slow per item).
   */
  paginated?: boolean
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
    id: "young-kids",
    label: "Tout-petits & enfants",
    icon: Baby,
    description:
      "Films 0–7 ans (animation/famille, certifiés tous publics). Chaque clic explore 2 pages plus loin pour combler le catalogue jeune.",
    endpoint: "/api/admin/import/movies",
    // Small page count to stay under the 60s limit (young titles are
    // mostly new → slow per item). `paginated` advances the cursor.
    params: { source: "young_kids", pages: 2, skipExisting: 1 },
    paginated: true,
  },
  {
    id: "games-recent",
    label: "Jeux récents",
    icon: Gamepad2,
    description: "Jeux vidéo récents populaires",
    endpoint: "/api/admin/batch-import",
    params: { type: "GAME", preset: "recent", limit: 20 },
  },
  {
    id: "mangas-popular",
    label: "Mangas populaires",
    icon: Library,
    description: "Top mangas par popularité (AniList)",
    endpoint: "/api/admin/import-manga",
    params: { source: "popular", limit: 25 },
  },
  {
    id: "mangas-weekly",
    label: "Nouveautés manga",
    icon: CalendarClock,
    description: "Mangas avec chapitres récents — alimente la rail hebdo",
    endpoint: "/api/admin/import-manga",
    params: { source: "weekly", limit: 25 },
  },
]

export function ImportPresetsBar({ onImportComplete, embedded }: ImportPresetsBarProps) {
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; count?: number; error?: string }>>({})
  // Per-preset page cursor for paginated presets — advances each click so
  // repeated presses dig deeper into the catalogue instead of re-fetching
  // the same first pages. Keyed by preset id; starts at page 1.
  const [pageCursor, setPageCursor] = useState<Record<string, number>>({})

  const handlePresetClick = async (preset: Preset) => {
    setLoadingPreset(preset.id)

    const startPage = preset.paginated ? pageCursor[preset.id] ?? 1 : undefined
    const pageStep = preset.paginated ? Number(preset.params.pages) || 1 : 0

    try {
      const res = await fetch(preset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          startPage !== undefined ? { ...preset.params, startPage } : preset.params,
        ),
      })

      const data = await res.json()
      // import/movies nests the count under `stats`; batch-import is flat.
      const count =
        data.imported ?? data.count ?? data.stats?.imported

      if (data.success) {
        setResults((prev) => ({
          ...prev,
          [preset.id]: { success: true, count },
        }))
        // Advance the cursor so the next click explores further pages.
        if (preset.paginated) {
          setPageCursor((prev) => ({
            ...prev,
            [preset.id]: (prev[preset.id] ?? 1) + pageStep,
          }))
        }
        onImportComplete?.()
      } else {
        setResults((prev) => ({
          ...prev,
          [preset.id]: { success: false, error: data.error },
        }))
      }
    } catch {
      setResults((prev) => ({
        ...prev,
        [preset.id]: { success: false, error: "Erreur réseau" },
      }))
    } finally {
      setLoadingPreset(null)
    }
  }

  return (
    <div className={embedded ? "" : "mb-6"}>
      <h3
        className={`text-sm font-medium mb-2 ${embedded ? "" : "text-gray-500"}`}
        style={embedded ? { color: APERCU_PALETTE.ink2 } : undefined}
      >
        Lots prédéfinis
      </h3>
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
                <span className="ml-1 text-xs">(+{result.count})</span>
              )}
              {preset.paginated && (pageCursor[preset.id] ?? 1) > 1 && (
                <span className="ml-1 text-[10px] opacity-60">
                  p.{pageCursor[preset.id]}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
