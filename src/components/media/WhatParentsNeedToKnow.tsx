import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { MethodBadge } from "@/components/ui/MethodBadge"

const SAGE = "#5C8A5C"
const AMBER = "#C08A3E"

interface WhatParentsNeedToKnowProps {
  items: string[]
  className?: string
}

export function WhatParentsNeedToKnow({
  items,
  className,
}: WhatParentsNeedToKnowProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  if (!items || items.length === 0) return null

  const getIcon = (text: string) => {
    const lowercaseText = text.toLowerCase()
    if (
      lowercaseText.includes("excellent") ||
      lowercaseText.includes("parfait") ||
      lowercaseText.includes("positif") ||
      lowercaseText.includes("encourage")
    ) {
      return (
        <CheckCircle2
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: SAGE }}
        />
      )
    }
    if (
      lowercaseText.includes("attention") ||
      lowercaseText.includes("supervision") ||
      lowercaseText.includes("difficile") ||
      lowercaseText.includes("effrayant")
    ) {
      return (
        <AlertCircle
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: AMBER }}
        />
      )
    }
    return (
      <Info
        className="h-5 w-5 shrink-0 mt-0.5"
        style={{ color: p.accent }}
      />
    )
  }

  return (
    <div
      className={cn("rounded-2xl", className)}
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div className="pb-3 p-5 flex items-center justify-between gap-2 flex-wrap">
        <h3
          className={`${serifClass} text-lg font-medium flex items-center gap-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          <Info className="h-5 w-5" style={{ color: p.accent }} />
          Ce que les parents doivent savoir
        </h3>
        <MethodBadge
          anchor="points-cles"
          description="Les points clés sont extraits par analyse automatisée du synopsis et du contenu analysé. Ils complètent mais ne remplacent pas l'avis de la communauté."
        />
      </div>
      <div className="px-5 pb-5 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-3">
            {getIcon(item)}
            <p className="text-sm leading-relaxed" style={{ color: p.ink }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
