"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Film, Tv, Gamepad2, BookOpen, BarChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface StatsCollapsibleProps {
  stats: {
    movies: number
    tv: number
    games: number
    books: number
    apps: number
    averageQualityScore: number
  }
  languageDistribution?: Array<{ language: string | null; count: number }>
}

export function StatsCollapsible({ stats, languageDistribution }: StatsCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const totalContent = stats.movies + stats.tv + stats.games + stats.books + stats.apps

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-700">Statistiques</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Détails
            </>
          )}
        </Button>
      </div>

      {/* Summary row - always visible */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1">
          <Film className="h-4 w-4 text-blue-500" />
          <strong>{stats.movies.toLocaleString()}</strong> films
        </span>
        <span className="flex items-center gap-1">
          <Tv className="h-4 w-4 text-purple-500" />
          <strong>{stats.tv.toLocaleString()}</strong> séries
        </span>
        <span className="flex items-center gap-1">
          <Gamepad2 className="h-4 w-4 text-green-500" />
          <strong>{stats.games.toLocaleString()}</strong> jeux
        </span>
        <span className="flex items-center gap-1">
          <BarChart className="h-4 w-4 text-orange-500" />
          Score moyen: <strong>{stats.averageQualityScore}%</strong>
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Film className="h-6 w-6 mx-auto text-blue-600 mb-1" />
                <div className="text-2xl font-bold text-blue-700">
                  {stats.movies.toLocaleString()}
                </div>
                <div className="text-xs text-blue-600">Films</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <Tv className="h-6 w-6 mx-auto text-purple-600 mb-1" />
                <div className="text-2xl font-bold text-purple-700">
                  {stats.tv.toLocaleString()}
                </div>
                <div className="text-xs text-purple-600">Séries</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Gamepad2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold text-green-700">
                  {stats.games.toLocaleString()}
                </div>
                <div className="text-xs text-green-600">Jeux</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <BookOpen className="h-6 w-6 mx-auto text-amber-600 mb-1" />
                <div className="text-2xl font-bold text-amber-700">
                  {stats.books.toLocaleString()}
                </div>
                <div className="text-xs text-amber-600">Livres</div>
              </div>
            </div>

            {/* Language distribution */}
            {languageDistribution && languageDistribution.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  Distribution par langue
                </h4>
                <div className="flex flex-wrap gap-2">
                  {languageDistribution.slice(0, 8).map((lang) => (
                    <span
                      key={lang.language || "unknown"}
                      className="px-2 py-1 bg-gray-100 rounded text-xs"
                    >
                      {lang.language?.toUpperCase() || "?"}: {lang.count.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total du catalogue</span>
                <span className="font-bold">{totalContent.toLocaleString()} contenus</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Score qualité moyen</span>
                <span
                  className={`font-bold ${
                    stats.averageQualityScore >= 70
                      ? "text-green-600"
                      : stats.averageQualityScore >= 50
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {stats.averageQualityScore}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
