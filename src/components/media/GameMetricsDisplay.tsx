"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { MethodBadge } from "@/components/ui/MethodBadge"

interface GameMetrics {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
}

interface GameMetricsDisplayProps {
  expertMetrics: GameMetrics
  topics?: string[]
}

const METRIC_META: Record<
  keyof GameMetrics,
  { label: string; description: string; isPositive?: boolean }
> = {
  violence: {
    label: "Violence",
    description: "Scènes de combat, armes, blessures ou violence graphique.",
  },
  language: {
    label: "Langage",
    description: "Insultes, jurons ou langage grossier dans le jeu.",
  },
  consumerism: {
    label: "Achats intégrés",
    description: "Microtransactions, battle pass, loot boxes ou contenu payant.",
  },
  substanceUse: {
    label: "Substances",
    description: "Références ou consommation d'alcool, tabac ou drogues.",
  },
  sexNudity: {
    label: "Sexualité",
    description: "Contenu romantique, suggestif ou nudité.",
  },
  positiveMessages: {
    label: "Messages +",
    description: "Valeurs positives : entraide, courage, fair-play.",
    isPositive: true,
  },
  roleModels: {
    label: "Modèles +",
    description: "Personnages exemplaires ou comportements à imiter.",
    isPositive: true,
  },
}

const GAME_VIGILANCE_KEYS: (keyof GameMetrics)[] = [
  "violence",
  "language",
  "consumerism",
  "substanceUse",
]

function ScoreTrack({ value, positive }: { value: number; positive?: boolean }) {
  const p = APERCU_PALETTE
  const fill = positive
    ? `linear-gradient(90deg,#e8835f,${p.accent})`
    : "linear-gradient(90deg,#b9ad9b,#a59885)"
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className="flex-1 h-[9px] rounded-md overflow-hidden"
        style={{ background: p.bg, border: `1px solid ${p.line}` }}
      >
        <span
          className="block h-full rounded-md"
          style={{ width: `${(value / 5) * 100}%`, background: fill }}
        />
      </span>
      <span className="font-serif font-semibold text-[15px] w-10 text-right shrink-0" style={{ color: p.ink }}>
        {value}
        <small className="text-[11px] font-sans" style={{ color: p.ink2 }}>
          /5
        </small>
      </span>
    </span>
  )
}

export function GameMetricsDisplay({ expertMetrics, topics = [] }: GameMetricsDisplayProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  const rows: (keyof GameMetrics)[] = [
    ...GAME_VIGILANCE_KEYS,
    ...(expertMetrics.sexNudity >= 2 ? (["sexNudity"] as const) : []),
    "positiveMessages",
    "roleModels",
  ]

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3
            className={`${serifClass} text-lg font-medium flex items-center gap-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Analyse Totem
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="À propos de l'analyse">
                    <Info className="h-4 w-4" style={{ color: p.ink2 }} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  Repères indépendants complétant le PEGI — achats en ligne, contenu réel et
                  sensibilité familiale.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <p className="text-sm mt-1" style={{ color: p.ink2 }}>
            Au-delà de la classification officielle
          </p>
        </div>
        <MethodBadge />
      </div>

      <div className="space-y-2">
        {rows.map((key) => {
          const meta = METRIC_META[key]
          const value = expertMetrics[key] ?? 0
          return (
            <div
              key={key}
              className="grid grid-cols-[minmax(88px,120px)_1fr] sm:grid-cols-[150px_1fr] gap-3 items-center py-1"
            >
              <TooltipProvider>
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
                    <p className="text-xs">{meta.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ScoreTrack value={value} positive={meta.isPositive} />
            </div>
          )
        })}
      </div>

      {topics.length > 0 && (
        <p className="mt-4 text-xs" style={{ color: p.ink2 }}>
          Thèmes repérés : {topics.slice(0, 5).join(", ")}
        </p>
      )}
    </div>
  )
}
