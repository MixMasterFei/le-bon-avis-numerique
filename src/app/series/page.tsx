"use client"

import { useState, useMemo } from "react"
import { Tv } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { FilterSidebar, type FilterState } from "@/components/media/FilterSidebar"
import { mockMediaItems } from "@/lib/mock-data"

export default function SeriesPage() {
  const [filters, setFilters] = useState<FilterState>({
    maxAge: 18,
    platforms: [],
    topics: [],
  })

  const series = useMemo(() => {
    let items = mockMediaItems.filter((m) => m.type === "TV")

    if (filters.maxAge < 18) {
      items = items.filter((m) => m.expertAgeRec <= filters.maxAge)
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
  }, [filters])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-500 rounded-xl text-white">
            <Tv className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Séries TV</h1>
        </div>
        <p className="text-gray-600">
          Trouvez les meilleures séries adaptées à l&apos;âge de vos enfants.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar onFiltersChange={setFilters} />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              {series.length} série{series.length !== 1 ? "s" : ""} trouvée{series.length !== 1 ? "s" : ""}
            </p>
          </div>

          {series.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {series.map((item) => (
                <MediaCard key={item.id} media={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Tv className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune série trouvée</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


