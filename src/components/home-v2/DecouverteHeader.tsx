import { APERCU_PALETTE } from "./apercuTheme"
import { formatRelativeTimeFr } from "@/lib/utils"

interface DecouverteHeaderProps {
  serifClass: string
  lastSynthesisAt: Date | null
  refreshSlot?: React.ReactNode // admin-only Rafraîchir button passed in
}

export function DecouverteHeader({
  serifClass,
  lastSynthesisAt,
  refreshSlot,
}: DecouverteHeaderProps) {
  const p = APERCU_PALETTE
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div
          className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
          style={{ color: p.accent }}
        >
          Découverte · {today}
        </div>
        <h1
          className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05]`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Aujourd&apos;hui pour{" "}
          <em className="italic" style={{ color: p.accent2 }}>
            votre famille
          </em>
        </h1>
        {lastSynthesisAt && (
          <div className="text-xs mt-2" style={{ color: p.ink2 }}>
            Mise à jour {formatRelativeTimeFr(lastSynthesisAt)}
          </div>
        )}
      </div>
      {refreshSlot}
    </header>
  )
}
