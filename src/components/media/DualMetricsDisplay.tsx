"use client"

import { useState, useEffect } from "react"
import { Users, Award, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMetricsButton } from "./UserMetricsButton"

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
  mediaTitle: string
  expertMetrics?: ContentMetrics | null
}

interface CommunityData {
  hasData: boolean
  count: number
  averages: ContentMetrics | null
}

const METRIC_LABELS: Record<string, { label: string; description: string; example: string; isPositive?: boolean }> = {
  violence: {
    label: "Violence",
    description: "Mesure la présence de violence physique, verbale ou psychologique dans le contenu.",
    example: "0 = Aucune violence. 5 = Violence intense et/ou graphique (combats, armes, sang)."
  },
  sexNudity: {
    label: "Sexe/Nudité",
    description: "Évalue la présence de contenu sexuel, scènes romantiques explicites ou nudité.",
    example: "0 = Aucun contenu. 5 = Scènes sexuelles explicites ou nudité complète."
  },
  language: {
    label: "Langage",
    description: "Indique la fréquence de langage grossier, insultes ou jurons.",
    example: "0 = Langage adapté à tous. 5 = Insultes fréquentes, langage très vulgaire."
  },
  consumerism: {
    label: "Consumérisme",
    description: "Mesure la présence de messages incitant à la consommation, placement de produits ou matérialisme.",
    example: "0 = Pas de messages commerciaux. 5 = Forte incitation à l'achat, nombreux placements produits."
  },
  substanceUse: {
    label: "Substances",
    description: "Évalue la représentation d'alcool, tabac, drogues ou autres substances.",
    example: "0 = Aucune représentation. 5 = Consommation fréquente ou banalisée."
  },
  positiveMessages: {
    label: "Messages +",
    description: "Note la présence de valeurs positives : amitié, courage, persévérance, empathie, entraide.",
    example: "0 = Pas de message particulier. 5 = Messages forts sur des valeurs importantes.",
    isPositive: true
  },
  roleModels: {
    label: "Modèles +",
    description: "Évalue la qualité des personnages comme modèles : comportements admirables, résolution de problèmes, respect des autres.",
    example: "0 = Pas de modèle positif. 5 = Personnages exemplaires et inspirants.",
    isPositive: true
  },
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
          {Object.entries(METRIC_LABELS).map(([key, { label, description, example, isPositive }]) => (
            <div key={key} className="flex items-center gap-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-gray-600 w-[85px] shrink-0 cursor-help underline decoration-dotted decoration-gray-400">
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs p-3">
                  <p className="font-medium text-sm mb-1">{label}</p>
                  <p className="text-xs text-gray-600 mb-2">{description}</p>
                  <p className="text-xs text-gray-500 italic">{example}</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex-1 min-w-0">
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

export function DualMetricsDisplay({ mediaId, mediaTitle, expertMetrics }: DualMetricsDisplayProps) {
  const [communityData, setCommunityData] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
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
      <CardContent className="space-y-4">
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

        {/* Evaluate button inside the card */}
        <UserMetricsButton
          mediaId={mediaId}
          mediaTitle={mediaTitle}
          onSubmit={() => fetchCommunityMetrics()}
        />
      </CardContent>
    </Card>
  )
}
