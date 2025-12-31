"use client"

import { useState, useEffect } from "react"
import { Users, Award, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ContentMetrics {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
}

interface DualMetricsDisplayProps {
  mediaId: string
  expertMetrics?: ContentMetrics | null
}

interface CommunityData {
  hasData: boolean
  count: number
  averages: ContentMetrics | null
}

const METRIC_LABELS: Record<string, { label: string; description: string; isPositive?: boolean }> = {
  violence: { label: "Violence", description: "Niveau de violence physique ou verbale" },
  sexNudity: { label: "Sexe/Nudite", description: "Contenu sexuel ou nudite" },
  language: { label: "Langage", description: "Langage grossier ou inapproprie" },
  consumerism: { label: "Consumerisme", description: "Messages commerciaux ou materialistes" },
  substanceUse: { label: "Substances", description: "Alcool, tabac ou drogues" },
  positiveMessages: { label: "Messages +", description: "Messages positifs et valeurs", isPositive: true },
  roleModels: { label: "Modeles +", description: "Bons exemples de comportement", isPositive: true },
}

function MetricBar({
  value,
  isPositive = false
}: {
  value: number
  isPositive?: boolean
}) {
  const percentage = (value / 5) * 100
  const color = isPositive
    ? "bg-green-500"
    : value <= 1
    ? "bg-green-500"
    : value <= 2
    ? "bg-yellow-500"
    : value <= 3
    ? "bg-orange-500"
    : "bg-red-500"

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium w-4 text-right">{value}</span>
    </div>
  )
}

function MetricsColumn({
  title,
  icon: Icon,
  metrics,
  count
}: {
  title: string
  icon: React.ElementType
  metrics: ContentMetrics | null
  count?: number
}) {
  if (!metrics) {
    return (
      <div className="flex-1 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-500">{title}</span>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">
          Pas de donnees
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {count !== undefined && (
          <span className="text-xs text-gray-500">({count} avis)</span>
        )}
      </div>

      <TooltipProvider>
        <div className="space-y-2">
          {Object.entries(METRIC_LABELS).map(([key, { label, description, isPositive }]) => (
            <div key={key} className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-600 w-20 truncate cursor-help">
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{description}</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex-1">
                <MetricBar
                  value={Math.round((metrics[key as keyof ContentMetrics] || 0) * 10) / 10}
                  isPositive={isPositive}
                />
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}

export function DualMetricsDisplay({ mediaId, expertMetrics }: DualMetricsDisplayProps) {
  const [communityData, setCommunityData] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCommunityMetrics = async () => {
      try {
        const res = await fetch(`/api/media/${mediaId}/community-metrics`)
        if (res.ok) {
          const data = await res.json()
          setCommunityData(data)
        }
      } catch (err) {
        console.error("Failed to fetch community metrics:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCommunityMetrics()
  }, [mediaId])

  // Don't render if no data at all
  if (!expertMetrics && !communityData?.hasData && !loading) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          Evaluation du contenu
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Echelle de 0 a 5. Pour violence, sexe, langage, etc.: 0 = absent, 5 = tres present. Pour messages positifs et modeles: 5 = excellent.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Expert metrics */}
          <MetricsColumn
            title="Le Bon Sens"
            icon={Award}
            metrics={expertMetrics || null}
          />

          {/* Community metrics */}
          {loading ? (
            <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
              <span className="text-sm text-gray-400">Chargement...</span>
            </div>
          ) : (
            <MetricsColumn
              title="Communaute"
              icon={Users}
              metrics={communityData?.averages || null}
              count={communityData?.count}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
