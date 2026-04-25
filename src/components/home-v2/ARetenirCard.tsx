"use client"

import { Sparkles } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Sidebar block: "À retenir cette semaine" — 3 short bullet points
 * the reader can take away without clicking anything. Sits at the top
 * of the sticky sidebar on desktop, inlines on mobile.
 *
 * For the Aperçu, takeaways are derived from the most recent dossier's
 * final paragraph (a quick split). Later we'll add a dedicated weekly
 * agent; the component shape doesn't change.
 */
export function ARetenirCard({
  takeaways,
  serifClass,
}: {
  takeaways: string[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  if (takeaways.length === 0) return null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.ink, color: p.bg }}
      >
        <Sparkles className="w-3 h-3" />
        À retenir cette semaine
      </div>
      <ul className="space-y-3">
        {takeaways.slice(0, 3).map((t, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={`${serifClass} text-lg font-semibold leading-none mt-0.5`}
              style={{ color: p.accent }}
            >
              {i + 1}
            </span>
            <span className="text-sm leading-snug" style={{ color: p.ink }}>
              {t}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
