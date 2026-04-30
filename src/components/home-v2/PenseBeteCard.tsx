"use client"

import { useState } from "react"
import { ListTodo, ChevronDown, ChevronUp } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { DeadlineInstance } from "@/lib/family-deadlines"

const MONTH_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]

const CATEGORY_COLOR: Record<DeadlineInstance["category"], string> = {
  impôts: "#E8A87C",      // peach
  école: "#8DBDC9",       // teal
  famille: "#B8D89A",     // sage
  santé: "#D89AB0",       // rose
  civique: "#A79BC7",     // violet
}

function formatShort(iso: string, daysUntil: number): string {
  if (daysUntil === 0) return "Aujourd'hui"
  if (daysUntil === 1) return "Demain"
  if (daysUntil <= 30) return `Dans ${daysUntil} j`
  // Parse with explicit Z + use UTC accessors so server (UTC) and
  // client (Paris) compute the same getDate()/getMonth() output.
  // Without this, the ISO is interpreted in different time zones
  // → React #418 hydration error.
  const d = new Date(iso + "T00:00:00Z")
  return `${d.getUTCDate()} ${MONTH_FR[d.getUTCMonth()]}`
}

/**
 * Sidebar widget: "Pense-Bête" — recurring administrative deadlines
 * (impôts, école, CAF, santé) curated in src/lib/family-deadlines.ts.
 *
 * Compact default: only the very next deadline, with a 1-line action
 * blurb. Click to expand the full upcoming list. Pattern matches
 * VacancesScolairesCard so the user learns the affordance once and
 * reuses it across the sidebar.
 */
export function PenseBeteCard({
  deadlines,
  serifClass,
}: {
  deadlines: DeadlineInstance[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [expanded, setExpanded] = useState(false)

  if (deadlines.length === 0) return null
  const next = deadlines[0]
  const rest = deadlines.slice(1)
  const nextColor = CATEGORY_COLOR[next.category]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.ink, color: p.bg }}
      >
        <ListTodo className="w-3 h-3" />
        Pense-Bête famille
      </div>

      {/* Headline: next upcoming deadline */}
      <div
        className={`${serifClass} text-2xl md:text-3xl font-medium leading-none mb-1`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        {formatShort(next.dateISO, next.daysUntil)}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: nextColor }}
          aria-hidden
        />
        <div className={`${serifClass} text-sm font-medium`} style={{ color: p.ink }}>
          {next.name}
        </div>
      </div>
      <div className="text-[11px]" style={{ color: p.ink2 }}>
        {next.blurb}
      </div>

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
            {expanded ? "Masquer" : `Tout voir (${rest.length})`}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <ul
              className="mt-3 pt-3 flex flex-col gap-3 text-xs"
              style={{ borderTop: `1px solid ${p.line}` }}
            >
              {rest.map((d) => (
                <li key={d.dateISO + d.name} className="flex gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: CATEGORY_COLOR[d.category] }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold whitespace-nowrap" style={{ color: p.accent }}>
                        {formatShort(d.dateISO, d.daysUntil)}
                      </span>
                      <span className="font-medium" style={{ color: p.ink }}>
                        {d.name}
                      </span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: p.ink2 }}>
                      {d.blurb}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
