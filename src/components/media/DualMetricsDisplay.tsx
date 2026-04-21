"use client"

import { useState, useEffect, useCallback } from "react"
import { Users, Award, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMetricsButton } from "./UserMetricsButton"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"
const AMBER = "#C08A3E"
const TERRACOTTA_MID = "#E08A5C"

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

const METRIC_LABELS: Record<
  string,
  { label: string; description: string; example: string; isPositive?: boolean }
> = {
  violence: {
    label: "Violence",
    description: "Mesure la présence de violence physique, verbale ou psychologique dans le contenu.",
    example: "0 = Aucune violence. 5 = Violence intense et/ou graphique (combats, armes, sang).",
  },
  sexNudity: {
    label: "Sexe/Nudité",
    description: "Évalue la présence de contenu sexuel, scènes romantiques explicites ou nudité.",
    example: "0 = Aucun contenu. 5 = Scènes sexuelles explicites ou nudité complète.",
  },
  language: {
    label: "Langage",
    description: "Indique la fréquence de langage grossier, insultes ou jurons.",
    example: "0 = Langage adapté à tous. 5 = Insultes fréquentes, langage très vulgaire.",
  },
  consumerism: {
    label: "Consumérisme",
    description: "Mesure la présence de messages incitant à la consommation, placement de produits ou matérialisme.",
    example: "0 = Pas de messages commerciaux. 5 = Forte incitation à l'achat, nombreux placements produits.",
  },
  substanceUse: {
    label: "Substances",
    description: "Évalue la représentation d'alcool, tabac, drogues ou autres substances.",
    example: "0 = Aucune représentation. 5 = Consommation fréquente ou banalisée.",
  },
  positiveMessages: {
    label: "Messages +",
    description: "Note la présence de valeurs positives : amitié, courage, persévérance, empathie, entraide.",
    example: "0 = Pas de message particulier. 5 = Messages forts sur des valeurs importantes.",
    isPositive: true,
  },
  roleModels: {
    label: "Modèles +",
    description: "Évalue la qualité des personnages comme modèles : comportements admirables, résolution de problèmes, respect des autres.",
    example: "0 = Pas de modèle positif. 5 = Personnages exemplaires et inspirants.",
    isPositive: true,
  },
}

function MetricBar({
  value,
  isPositive = false,
}: {
  value: number
  isPositive?: boolean
}) {
  const p = APERCU_PALETTE
  const percentage = (value / 5) * 100
  const color = isPositive
    ? SAGE
    : value <= 1
      ? SAGE
      : value <= 2
        ? AMBER
        : value <= 3
          ? TERRACOTTA_MID
          : p.accent

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: p.bg2 }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
      <span
        className="text-xs font-medium w-4 text-right"
        style={{ color: p.ink }}
      >
        {value}
      </span>
    </div>
  )
}

function MetricsColumn({
  title,
  icon: Icon,
  metrics,
  count,
}: {
  title: string
  icon: React.ElementType
  metrics: ContentMetrics | null
  count?: number
}) {
  const p = APERCU_PALETTE

  if (!metrics) {
    return (
      <div
        className="flex-1 p-4 rounded-xl"
        style={{ background: p.bg2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4" style={{ color: p.ink2 }} />
          <span className="text-sm font-medium" style={{ color: p.ink2 }}>
            {title}
          </span>
        </div>
        <p
          className="text-sm text-center py-4"
          style={{ color: p.ink2 }}
        >
          Pas de données
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 rounded-xl" style={{ background: p.bg2 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: p.accent }} />
          <span className="text-sm font-medium" style={{ color: p.ink }}>
            {title}
          </span>
        </div>
        {count !== undefined && (
          <span className="text-xs" style={{ color: p.ink2 }}>
            ({count} avis)
          </span>
        )}
      </div>

      <TooltipProvider>
        <div className="space-y-2">
          {Object.entries(METRIC_LABELS).map(
            ([key, { label, description, example, isPositive }]) => (
              <div key={key} className="flex items-center gap-2">
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span
                      className="text-[11px] w-[85px] shrink-0 cursor-help underline decoration-dotted"
                      style={{
                        color: p.ink2,
                        textDecorationColor: p.line2,
                      }}
                    >
                      {label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs p-3">
                    <p className="font-medium text-sm mb-1">{label}</p>
                    <p className="text-xs mb-2">{description}</p>
                    <p className="text-xs italic opacity-70">{example}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex-1 min-w-0">
                  <MetricBar
                    value={
                      Math.round(
                        (metrics[key as keyof ContentMetrics] || 0) * 10
                      ) / 10
                    }
                    isPositive={isPositive}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </TooltipProvider>
    </div>
  )
}

export function DualMetricsDisplay({
  mediaId,
  mediaTitle,
  expertMetrics,
}: DualMetricsDisplayProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [communityData, setCommunityData] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCommunityMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/media/${mediaId}/community-metrics`)
      if (res.ok) {
        const data = await res.json()
        queueMicrotask(() => setCommunityData(data))
      }
    } catch (err) {
      console.error("Failed to fetch community metrics:", err)
    } finally {
      queueMicrotask(() => setLoading(false))
    }
  }, [mediaId])

  useEffect(() => {
    fetchCommunityMetrics()
  }, [fetchCommunityMetrics])

  if (!expertMetrics && !communityData?.hasData && !loading) {
    return null
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <h3
          className={`${serifClass} text-lg font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Évaluation du contenu
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4" style={{ color: p.ink2 }} />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Échelle de 0 à 5. Pour violence, sexe, langage, etc. :
                0 = absent, 5 = très présent. Pour messages positifs et
                modèles : 5 = excellent.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="space-y-4">
        <div className="flex gap-3">
          <MetricsColumn
            title="Totem Avisé"
            icon={Award}
            metrics={expertMetrics || null}
          />

          {loading ? (
            <div
              className="flex-1 p-4 rounded-xl flex items-center justify-center"
              style={{ background: p.bg2 }}
            >
              <span className="text-sm" style={{ color: p.ink2 }}>
                Chargement...
              </span>
            </div>
          ) : (
            <MetricsColumn
              title="Communauté"
              icon={Users}
              metrics={communityData?.averages || null}
              count={communityData?.count}
            />
          )}
        </div>

        <UserMetricsButton
          mediaId={mediaId}
          mediaTitle={mediaTitle}
          onSubmit={() => fetchCommunityMetrics()}
        />
      </div>
    </div>
  )
}
