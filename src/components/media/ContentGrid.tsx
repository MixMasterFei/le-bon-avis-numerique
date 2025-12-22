"use client"

import { Progress } from "@/components/ui/progress"
import { cn, contentMetricLabels, getMetricColor } from "@/lib/utils"

interface ContentMetrics {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
}

interface ContentGridProps {
  metrics: ContentMetrics
  showLabels?: boolean
  compact?: boolean
  className?: string
}

export function ContentGrid({
  metrics,
  showLabels = true,
  compact = false,
  className,
}: ContentGridProps) {
  const metricEntries = [
    { key: "violence", value: metrics.violence, isNegative: true },
    { key: "sexNudity", value: metrics.sexNudity, isNegative: true },
    { key: "language", value: metrics.language, isNegative: true },
    { key: "consumerism", value: metrics.consumerism, isNegative: true },
    { key: "substanceUse", value: metrics.substanceUse, isNegative: true },
    { key: "positiveMessages", value: metrics.positiveMessages, isNegative: false },
    { key: "roleModels", value: metrics.roleModels, isNegative: false },
  ]

  const getIndicatorColor = (value: number, isNegative: boolean) => {
    if (isNegative) {
      // For negative metrics: low is good (green), high is bad (red)
      if (value <= 1) return "bg-emerald-500"
      if (value <= 3) return "bg-amber-500"
      return "bg-red-500"
    } else {
      // For positive metrics: high is good (green), low is concerning
      if (value >= 4) return "bg-emerald-500"
      if (value >= 2) return "bg-amber-500"
      return "bg-red-500"
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
        Jauge de Contenu
      </h3>
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {metricEntries.map(({ key, value, isNegative }) => (
          <div
            key={key}
            className={cn(
              "flex items-center gap-3",
              compact && "gap-2"
            )}
          >
            {showLabels && (
              <span
                className={cn(
                  "text-sm text-gray-600 w-32 shrink-0",
                  compact && "w-24 text-xs"
                )}
              >
                {contentMetricLabels[key]}
              </span>
            )}
            <div className="flex-1">
              <Progress
                value={(value / 5) * 100}
                className={cn("h-2", compact && "h-1.5")}
                indicatorClassName={getIndicatorColor(value, isNegative)}
              />
            </div>
            <span
              className={cn(
                "text-sm font-medium w-6 text-right",
                compact && "text-xs w-4"
              )}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Faible/Positif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>Modéré</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Élevé</span>
        </div>
      </div>
    </div>
  )
}

// Compact version for cards
export function ContentGridDots({
  metrics,
  className,
}: {
  metrics: ContentMetrics
  className?: string
}) {
  const getDotColor = (value: number) => {
    if (value <= 1) return "bg-emerald-500"
    if (value <= 3) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <div className={cn("flex gap-1", className)}>
      <div
        className={cn("h-2 w-2 rounded-full", getDotColor(metrics.violence))}
        title="Violence"
      />
      <div
        className={cn("h-2 w-2 rounded-full", getDotColor(metrics.sexNudity))}
        title="Sexe & Nudité"
      />
      <div
        className={cn("h-2 w-2 rounded-full", getDotColor(metrics.language))}
        title="Langage"
      />
      <div
        className={cn("h-2 w-2 rounded-full", getDotColor(metrics.consumerism))}
        title="Consommation"
      />
      <div
        className={cn("h-2 w-2 rounded-full", getDotColor(metrics.substanceUse))}
        title="Alcool & Drogues"
      />
    </div>
  )
}

