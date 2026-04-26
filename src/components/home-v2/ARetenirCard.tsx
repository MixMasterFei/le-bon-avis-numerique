"use client"

import { Sparkles } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

export interface Takeaway {
  text: string
  source?: string  // Optional attribution: "Le Monde", "Pew Research"
}

/**
 * Sidebar block: "À retenir cette semaine" — 3 short bullet points
 * the reader can take away without clicking anything. Sits at the top
 * of the sticky sidebar on desktop, inlines on mobile.
 *
 * Each bullet can carry an optional source attribution (Xavier's ask:
 * "It should be sourced as well"). Renders as "→ Le Monde" beneath
 * the bullet when present.
 */
export function ARetenirCard({
  takeaways,
  serifClass,
}: {
  takeaways: Takeaway[]
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
      <ul className="space-y-3.5">
        {takeaways.slice(0, 3).map((t, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={`${serifClass} text-lg font-semibold leading-none mt-0.5`}
              style={{ color: p.accent }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm leading-snug block" style={{ color: p.ink }}>
                {t.text}
              </span>
              {t.source && (
                <span
                  className="text-[10px] mt-1 block uppercase tracking-wide font-semibold"
                  style={{ color: p.ink2 }}
                >
                  → {t.source}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
