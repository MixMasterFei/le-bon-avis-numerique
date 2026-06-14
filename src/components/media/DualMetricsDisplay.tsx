"use client"

import { useState, useEffect, useCallback } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMetricsButton } from "./UserMetricsButton"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { MethodBadge } from "@/components/ui/MethodBadge"

interface ContentMetrics {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
  educationalValue?: number
}

interface DualMetricsDisplayProps {
  mediaId: string
  mediaTitle: string
  expertMetrics?: ContentMetrics | null
  topics?: string[]
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
  educationalValue: {
    label: "Éducatif",
    description: "Estime le potentiel éducatif du contenu : connaissances, découverte, culture, réflexion ou apprentissage.",
    example: "0 = Pas d'apport éducatif clair. 5 = Dimension éducative centrale.",
    isPositive: true,
  },
}

function deriveEducationalValue(metrics: ContentMetrics, topics: string[] = []): number {
  const lowerTopics = topics.map((topic) => topic.toLowerCase())
  if (lowerTopics.some((topic) => topic.includes("éducatif") || topic.includes("educatif") || topic.includes("documentaire"))) {
    return 5
  }
  if (lowerTopics.some((topic) => topic.includes("science") || topic.includes("histoire") || topic.includes("culture"))) {
    return 4
  }

  return Math.max(0, Math.min(5, Math.round((metrics.positiveMessages + metrics.roleModels) / 3)))
}

function withEducationalValue(metrics: ContentMetrics | null, topics: string[] = []): ContentMetrics | null {
  if (!metrics) return null
  return {
    ...metrics,
    educationalValue: metrics.educationalValue ?? deriveEducationalValue(metrics, topics),
  }
}

// Track fills — solid for Totem (our analysis), hatched for Community votes,
// mirroring the redesign prototype's scorecard legend.
const TOTEM_NEG = "linear-gradient(90deg,#b9ad9b,#a59885)"
const TOTEM_POS = `linear-gradient(90deg,#e8835f,${APERCU_PALETTE.accent})`
const COMM_NEG = "repeating-linear-gradient(45deg,#cabfae 0 4px,#e9e1d3 4px,#e9e1d3 7px)"
const COMM_POS = "repeating-linear-gradient(45deg,#eaa288 0 4px,#f7dccf 4px,#f7dccf 7px)"

const VIGILANCE_KEYS: (keyof ContentMetrics)[] = [
  "violence",
  "sexNudity",
  "language",
  "consumerism",
  "substanceUse",
]
const POSITIVE_KEYS: (keyof ContentMetrics)[] = [
  "positiveMessages",
  "roleModels",
  "educationalValue",
]

const ROW_GRID = "grid grid-cols-[88px_1fr_1fr] sm:grid-cols-[150px_1fr_1fr] gap-3 sm:gap-4 items-center"

const formatScore = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

// One score track + numeric readout. `value === null` renders an empty,
// honest "no data" track (used for the Community column before any votes).
function ScoreTrack({ value, fill }: { value: number | null; fill: string }) {
  const p = APERCU_PALETTE
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className="flex-1 h-[9px] rounded-md overflow-hidden"
        style={{ background: p.bg, border: `1px solid ${p.line}` }}
      >
        {value !== null && (
          <span
            className="block h-full rounded-md transition-all"
            style={{ width: `${(value / 5) * 100}%`, background: fill }}
          />
        )}
      </span>
      <span
        className="font-serif font-semibold text-[15px] w-10 text-right shrink-0"
        style={{ color: value === null ? p.ink2 : p.ink }}
      >
        {value === null ? (
          "—"
        ) : (
          <>
            {formatScore(value)}
            <small className="text-[11px] font-sans" style={{ color: p.ink2 }}>
              /5
            </small>
          </>
        )}
      </span>
    </span>
  )
}

// A single metric row: tooltip-labelled name + Totem track + Community track.
function ScoreRow({
  metricKey,
  expert,
  community,
  hasComm,
}: {
  metricKey: keyof ContentMetrics
  expert: ContentMetrics | null
  community: ContentMetrics | null
  hasComm: boolean
}) {
  const p = APERCU_PALETTE
  const meta = METRIC_LABELS[metricKey]
  if (!meta) return null
  const isPositive = !!meta.isPositive
  const expertVal = expert ? Math.round((expert[metricKey] || 0) * 10) / 10 : null
  const commVal = hasComm && community ? Math.round((community[metricKey] || 0) * 10) / 10 : null

  return (
    <div className={`${ROW_GRID} py-1`}>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className="text-[13px] font-medium cursor-help underline decoration-dotted truncate"
            style={{ color: p.ink, textDecorationColor: p.line2 }}
          >
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <p className="font-medium text-sm mb-1">{meta.label}</p>
          <p className="text-xs mb-2">{meta.description}</p>
          <p className="text-xs italic opacity-70">{meta.example}</p>
        </TooltipContent>
      </Tooltip>
      <ScoreTrack value={expertVal} fill={isPositive ? TOTEM_POS : TOTEM_NEG} />
      <ScoreTrack value={commVal} fill={isPositive ? COMM_POS : COMM_NEG} />
    </div>
  )
}

export function DualMetricsDisplay({
  mediaId,
  mediaTitle,
  expertMetrics,
  topics = [],
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

  const expert = withEducationalValue(expertMetrics || null, topics)
  const community = withEducationalValue(communityData?.averages || null, topics)
  const hasComm = !!communityData?.hasData
  const commCount = communityData?.count ?? 0

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3
          className={`${serifClass} text-lg sm:text-xl font-medium flex items-center gap-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Évaluation du contenu
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4" style={{ color: p.ink2 }} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Échelle de 0 à 5. Pour violence, sexe, langage, etc. :
                  0 = absent, 5 = très présent. Pour les dimensions positives,
                  5 = très fort.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h3>
        <MethodBadge
          anchor="metriques-contenu"
          description="Les 8 dimensions (violence, sexe, langage, valeur éducative, etc.) sont estimées par analyse automatisée du synopsis et des classifications officielles. Les dimensions évaluables sont recalibrées par les familles inscrites."
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3 text-[13px]" style={{ color: p.ink2 }}>
        <span className="inline-flex items-center gap-2">
          <span className="w-5 h-2.5 rounded" style={{ background: p.ink2 }} />
          Totem Avisé — notre analyse
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-5 h-2.5 rounded" style={{ background: COMM_NEG, border: `1px solid ${p.line2}` }} />
          Communauté — notes des spectateurs
        </span>
      </div>

      <TooltipProvider>
        {/* Column headers */}
        <div className={`${ROW_GRID} items-end pb-1.5 mb-1 border-b`} style={{ borderColor: p.line }}>
          <span />
          <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: p.ink2 }}>
            Totem Avisé
          </span>
          <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: p.ink2 }}>
            Communauté
            <small className="block font-normal tracking-normal normal-case" style={{ color: p.ink2 }}>
              {hasComm ? `${commCount} avis` : "aucune note"}
            </small>
          </span>
        </div>

        {/* Points de vigilance */}
        <div className="text-[11px] uppercase tracking-wider font-bold mt-3 mb-1" style={{ color: p.ink2 }}>
          Points de vigilance
        </div>
        {VIGILANCE_KEYS.map((k) => (
          <ScoreRow key={k} metricKey={k} expert={expert} community={community} hasComm={hasComm} />
        ))}

        {/* Points positifs */}
        <div className="text-[11px] uppercase tracking-wider font-bold mt-3 mb-1" style={{ color: p.accent }}>
          Points positifs
        </div>
        {POSITIVE_KEYS.map((k) => (
          <ScoreRow key={k} metricKey={k} expert={expert} community={community} hasComm={hasComm} />
        ))}
      </TooltipProvider>

      {/* Contribute */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${p.line}` }}>
        {!hasComm && (
          <p className="text-[13px] mb-2" style={{ color: p.ink2 }}>
            {loading
              ? "Chargement des notes de la communauté…"
              : "Aucune note de la communauté pour l'instant — soyez le premier à noter."}
          </p>
        )}
        <UserMetricsButton
          mediaId={mediaId}
          mediaTitle={mediaTitle}
          onSubmit={() => fetchCommunityMetrics()}
        />
      </div>
    </div>
  )
}
