import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { MethodBadge } from "@/components/ui/MethodBadge"

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

  return (
    <div
      className={cn("rounded-2xl p-5 sm:p-6", className)}
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 1px 2px rgba(58,46,34,.05), 0 14px 34px -18px rgba(58,46,34,.18)",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2
          className={`${serifClass} text-xl sm:text-2xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          Ce que les parents doivent savoir
        </h2>
        <MethodBadge
          anchor="points-cles"
          description="Les points clés sont extraits par analyse automatisée du synopsis et du contenu analysé. Ils complètent mais ne remplacent pas l'avis de la communauté."
        />
      </div>
      <div className="flex flex-col gap-2 mt-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex gap-3 items-start rounded-xl px-3.5 py-2.5"
            style={{ background: p.bg, border: `1px solid ${p.line}` }}
          >
            <span
              className="flex items-center justify-center shrink-0 rounded-full text-[13px] font-bold"
              style={{
                width: 26,
                height: 26,
                background: p.card,
                border: `1px solid ${p.line2}`,
                color: p.accent,
              }}
            >
              {index + 1}
            </span>
            <p className="text-[15px] leading-[1.45]" style={{ color: p.ink2 }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
