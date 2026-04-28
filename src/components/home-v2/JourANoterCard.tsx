"use client"

import { useState } from "react"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { NotableDateInstance } from "@/lib/notable-dates"

const MONTH_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

function formatShort(iso: string, daysUntil: number): string {
  if (daysUntil === 0) return "Aujourd'hui"
  if (daysUntil === 1) return "Demain"
  const d = new Date(iso + "T00:00:00")
  return `${d.getDate()} ${MONTH_FR[d.getMonth()]}`
}

/**
 * Sidebar widget: well-known French civic / cultural dates. Compact
 * default (next upcoming date), click to expand the full upcoming
 * list. Curated list lives in src/lib/notable-dates.ts.
 */
export function JourANoterCard({
  dates,
  serifClass,
}: {
  dates: NotableDateInstance[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [expanded, setExpanded] = useState(false)

  if (dates.length === 0) return null
  const next = dates[0]
  const rest = dates.slice(1)

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.accent2, color: "#FFFFFF" }}
      >
        <Sparkles className="w-3 h-3" />
        Jour à noter
      </div>

      {/* Headline: next upcoming date */}
      <div
        className={`${serifClass} text-2xl md:text-3xl font-medium leading-none mb-1`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        {formatShort(next.dateISO, next.daysUntil)}
      </div>
      <div className={`${serifClass} text-sm font-medium`} style={{ color: p.ink }}>
        {next.name}
      </div>
      {next.blurb && (
        <div className="text-[11px] mt-1" style={{ color: p.ink2 }}>
          {next.blurb}
        </div>
      )}

      {/* Expand to full upcoming list */}
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: p.ink2 }}
            aria-expanded={expanded}
          >
            {expanded ? "Masquer" : `Et ${rest.length} de plus`}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <ul
              className="mt-3 pt-3 flex flex-col gap-2 text-xs"
              style={{ borderTop: `1px solid ${p.line}` }}
            >
              {rest.map((d) => (
                <li key={d.dateISO + d.name} className="flex gap-3">
                  <span
                    className="font-semibold whitespace-nowrap shrink-0"
                    style={{ color: p.accent2, minWidth: 70 }}
                  >
                    {formatShort(d.dateISO, d.daysUntil)}
                  </span>
                  <span style={{ color: p.ink }}>{d.name}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
