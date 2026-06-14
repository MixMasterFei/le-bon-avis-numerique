import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { MethodBadge } from "@/components/ui/MethodBadge"

interface SensitiveWarningsProps {
  items: string[]
  className?: string
}

/**
 * "Ce qui peut marquer" — hedged, AI-generated category flags (deuil, scènes
 * effrayantes, séparation…). Deliberately framed as points *à surveiller*, NOT
 * verified scenes: the hedge lives once here in the header + MethodBadge, so the
 * items themselves stay short neutral category labels (see
 * src/lib/sensitive-warnings.ts). The page only renders this card when AI
 * confidence is high enough (>= 0.6), so we never surface low-confidence guesses.
 */
export function SensitiveWarnings({ items, className }: SensitiveWarningsProps) {
  const p = APERCU_PALETTE

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
          className="font-serif text-xl sm:text-2xl font-medium flex items-center gap-2"
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: p.accent }} />
          Ce qui peut marquer
        </h2>
        <MethodBadge
          iconOnly
          anchor="points-a-surveiller"
          description="Repères de vigilance identifiés par analyse automatisée du synopsis et du contenu. Ce sont des points à vérifier selon la sensibilité de votre enfant — pas des scènes confirmées."
        />
      </div>

      <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: p.ink2 }}>
        Points à surveiller selon la sensibilité de votre enfant — à vérifier
        vous-même, il ne s&apos;agit pas de scènes confirmées.
      </p>

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px]"
            style={{ background: p.bg, border: `1px solid ${p.line2}`, color: p.ink2 }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: p.accent }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
