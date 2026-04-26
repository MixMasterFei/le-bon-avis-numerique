"use client"

import { BarChart3 } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

export interface WeekStats {
  storiesPublished: number
  internationalCount: number
  studiesCited: number
  sourcesCovered: number
}

/**
 * Sidebar block: "Cette semaine en chiffres" — quick numerical pulse
 * showing the editorial activity. Reinforces the "this site does
 * actual work" signal without bragging.
 */
export function WeekStatsCard({
  stats,
  serifClass,
}: {
  stats: WeekStats
  serifClass: string
}) {
  const p = APERCU_PALETTE

  const rows: Array<{ value: number; label: string }> = [
    { value: stats.storiesPublished, label: "actualités publiées" },
    { value: stats.internationalCount, label: "vues d'ailleurs" },
    { value: stats.studiesCited, label: "études citées" },
    { value: stats.sourcesCovered, label: "sources suivies" },
  ]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.ink, color: p.bg }}
      >
        <BarChart3 className="w-3 h-3" />
        Cette semaine en chiffres
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <dt
              className={`${serifClass} text-2xl md:text-3xl font-medium leading-none`}
              style={{ color: p.accent, letterSpacing: "-0.02em" }}
            >
              {r.value}
            </dt>
            <dd className="text-[11px] mt-1" style={{ color: p.ink2 }}>
              {r.label}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
