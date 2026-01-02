import { cn } from "@/lib/utils"
import {
  Swords,
  Heart,
  MessageCircle,
  Skull,
  Cigarette,
  DollarSign,
  Users,
  Globe,
  Gamepad2,
  AlertTriangle
} from "lucide-react"

// PEGI content descriptors
export type PEGIDescriptor =
  | "violence"
  | "bad_language"
  | "fear"
  | "sex"
  | "drugs"
  | "discrimination"
  | "gambling"
  | "in_game_purchases"
  | "online"

interface DescriptorConfig {
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
}

const DESCRIPTOR_CONFIG: Record<PEGIDescriptor, DescriptorConfig> = {
  violence: {
    label: "Violence",
    description: "Le jeu contient des representations de violence",
    icon: Swords,
    color: "text-red-600",
    bgColor: "bg-red-50"
  },
  bad_language: {
    label: "Langage grossier",
    description: "Le jeu contient un langage grossier",
    icon: MessageCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-50"
  },
  fear: {
    label: "Peur",
    description: "Le jeu peut faire peur aux jeunes enfants",
    icon: Skull,
    color: "text-purple-600",
    bgColor: "bg-purple-50"
  },
  sex: {
    label: "Contenu sexuel",
    description: "Le jeu contient des images de nature sexuelle",
    icon: Heart,
    color: "text-pink-600",
    bgColor: "bg-pink-50"
  },
  drugs: {
    label: "Drogues",
    description: "Le jeu fait reference a ou represente des drogues",
    icon: Cigarette,
    color: "text-amber-600",
    bgColor: "bg-amber-50"
  },
  discrimination: {
    label: "Discrimination",
    description: "Le jeu contient des representations stereotypees",
    icon: Users,
    color: "text-slate-600",
    bgColor: "bg-slate-50"
  },
  gambling: {
    label: "Jeux de hasard",
    description: "Le jeu enseigne ou encourage les jeux d'argent",
    icon: DollarSign,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50"
  },
  in_game_purchases: {
    label: "Achats integres",
    description: "Le jeu propose des achats avec de l'argent reel",
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50"
  },
  online: {
    label: "Jeu en ligne",
    description: "Le jeu peut etre joue en ligne avec d'autres joueurs",
    icon: Globe,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  }
}

// Map content metrics to PEGI descriptors
export function metricsToDescriptors(metrics: {
  violence?: number
  sexNudity?: number
  language?: number
  substanceUse?: number
  consumerism?: number
}): PEGIDescriptor[] {
  const descriptors: PEGIDescriptor[] = []

  if (metrics.violence && metrics.violence >= 3) {
    descriptors.push("violence")
  }
  if (metrics.sexNudity && metrics.sexNudity >= 3) {
    descriptors.push("sex")
  }
  if (metrics.language && metrics.language >= 3) {
    descriptors.push("bad_language")
  }
  if (metrics.substanceUse && metrics.substanceUse >= 3) {
    descriptors.push("drugs")
  }
  if (metrics.consumerism && metrics.consumerism >= 4) {
    descriptors.push("in_game_purchases")
  }

  return descriptors
}

interface PEGIDescriptorsProps {
  descriptors?: PEGIDescriptor[]
  metrics?: {
    violence?: number
    sexNudity?: number
    language?: number
    substanceUse?: number
    consumerism?: number
  }
  variant?: "compact" | "full" | "inline"
  className?: string
}

export function PEGIDescriptors({
  descriptors: providedDescriptors,
  metrics,
  variant = "compact",
  className
}: PEGIDescriptorsProps) {
  // Use provided descriptors or derive from metrics
  const descriptors = providedDescriptors || (metrics ? metricsToDescriptors(metrics) : [])

  if (descriptors.length === 0) {
    return null
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {descriptors.map((descriptor) => {
          const config = DESCRIPTOR_CONFIG[descriptor]
          const Icon = config.icon
          return (
            <span
              key={descriptor}
              className={cn(
                "inline-flex items-center justify-center h-6 w-6 rounded",
                config.bgColor,
                config.color
              )}
              title={config.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )
        })}
      </div>
    )
  }

  if (variant === "full") {
    return (
      <div className={cn("space-y-3", className)}>
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Avertissements de contenu
        </h4>
        <div className="space-y-2">
          {descriptors.map((descriptor) => {
            const config = DESCRIPTOR_CONFIG[descriptor]
            const Icon = config.icon
            return (
              <div
                key={descriptor}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg",
                  config.bgColor
                )}
              >
                <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
                <div>
                  <p className={cn("font-medium text-sm", config.color)}>
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {config.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Compact variant (default)
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {descriptors.map((descriptor) => {
        const config = DESCRIPTOR_CONFIG[descriptor]
        const Icon = config.icon
        return (
          <span
            key={descriptor}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              config.bgColor,
              config.color
            )}
            title={config.description}
          >
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </span>
        )
      })}
    </div>
  )
}

// Special warning for in-game purchases
interface InGamePurchasesWarningProps {
  hasInGamePurchases?: boolean
  consumerismScore?: number
  className?: string
}

export function InGamePurchasesWarning({
  hasInGamePurchases,
  consumerismScore,
  className
}: InGamePurchasesWarningProps) {
  // Show warning if explicitly flagged or high consumerism score
  const shouldShow = hasInGamePurchases || (consumerismScore && consumerismScore >= 4)

  if (!shouldShow) return null

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200",
      className
    )}>
      <DollarSign className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800 text-sm">
          Achats integres
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Ce jeu propose des achats avec de l'argent reel.
          Les parents doivent configurer les controles parentaux pour limiter les depenses.
        </p>
      </div>
    </div>
  )
}

// Online play indicator
interface OnlinePlayIndicatorProps {
  hasOnlineFeatures?: boolean
  className?: string
}

export function OnlinePlayIndicator({
  hasOnlineFeatures,
  className
}: OnlinePlayIndicatorProps) {
  if (!hasOnlineFeatures) return null

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200",
      className
    )}>
      <Globe className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-blue-800 text-sm">
          Jeu en ligne
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Ce jeu permet de jouer en ligne avec d'autres personnes.
          Les interactions ne peuvent pas etre entierement controlees.
        </p>
      </div>
    </div>
  )
}
