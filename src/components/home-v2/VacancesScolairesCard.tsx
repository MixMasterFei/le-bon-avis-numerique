"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { Zone, SerializableHoliday, CalendarHoliday } from "@/lib/school-holidays"

// Re-exported for back-compat with existing client-side imports.
// Source of truth lives in @/lib/school-holidays so the server page
// can call holidayToSerializable without crossing the RSC boundary.
export type { SerializableHoliday } from "@/lib/school-holidays"

// Per-zone identity colors. Picked from the existing age-bucket
// palette so the card stays in the brand's chromatic universe.
const ZONE_COLOR: Record<Zone, string> = {
  A: "#E8A87C", // warm peach
  B: "#8DBDC9", // teal
  C: "#B8D89A", // sage green
}
const ALL_ZONE_COLOR = "#A79BC7" // soft violet for "Toutes zones"

function formatRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
  return `${fmt(start)} → ${fmt(end)}`
}

/**
 * Sidebar widget: Vacances scolaires — countdown to the next school
 * holiday for the user's zone (A/B/C). The most-requested info for
 * any French parent. Defaults to Zone B; tap toggles through zones
 * (state stored in localStorage so it persists between visits).
 *
 * Data source: data.gouv.fr (Ministère de l'Éducation), fetched
 * server-side once a day. See src/lib/school-holidays.ts.
 */
export function VacancesScolairesCard({
  initialFR,
  initialZoneA,
  initialZoneC,
  calendar,
  serifClass,
}: {
  initialFR: SerializableHoliday | null   // Zone B (default)
  initialZoneA: SerializableHoliday | null
  initialZoneC: SerializableHoliday | null
  // 90-day window of upcoming holidays for the expandable calendar.
  // Empty array hides the expand affordance.
  calendar: CalendarHoliday[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  // Always start from "B" so server-rendered HTML matches the client's
  // first render (no hydration mismatch). Restore the saved zone in a
  // post-hydration effect — a one-frame visual flicker on cold loads
  // is preferable to a React #418 hydration error.
  const [zone, setZone] = useState<Zone>("B")
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const stored = window.localStorage.getItem("totem.holidayZone")
    // setState-in-effect is required here: we deliberately render
    // "B" on first paint (matching SSR) and only swap to the saved
    // zone post-hydration. Any non-effect approach would re-introduce
    // the React #418 hydration mismatch this hook was added to fix.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "A" || stored === "C") setZone(stored)
  }, [])

  const data = zone === "A" ? initialZoneA : zone === "C" ? initialZoneC : initialFR
  if (!data) return null  // API failed and no cache — hide the widget

  const switchZone = (z: Zone) => {
    setZone(z)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("totem.holidayZone", z)
    }
  }

  const headline = data.isOngoing
    ? "En cours"
    : data.daysUntilStart === 0
    ? "Demain"
    : `J−${data.daysUntilStart}`

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: p.accent, color: "#FFFFFF" }}
        >
          <CalendarDays className="w-3 h-3" />
          Vacances scolaires
        </div>
        {/* Zone toggle — three small buttons, no dropdown noise. */}
        <div className="flex gap-0.5" role="tablist" aria-label="Zone scolaire">
          {(["A", "B", "C"] as const).map((z) => {
            const active = z === zone
            return (
              <button
                key={z}
                type="button"
                onClick={() => switchZone(z)}
                className="px-2 py-0.5 rounded text-[10px] font-bold transition-colors"
                style={{
                  background: active ? p.ink : "transparent",
                  color: active ? p.bg : p.ink2,
                }}
                aria-pressed={active}
                aria-label={`Zone ${z}`}
              >
                {z}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={`${serifClass} text-3xl md:text-4xl font-medium leading-none mb-1`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        {headline}
      </div>
      <div className={`${serifClass} text-sm font-medium mb-1`} style={{ color: p.ink }}>
        {data.description}
      </div>
      <div className="text-[11px]" style={{ color: p.ink2 }}>
        {formatRange(data.startISO, data.endISO)} · Zone {data.zone}
      </div>

      {/* Expandable 3-month calendar — shows all 3 zones color-coded
          so a parent can scan upcoming overlaps at a glance. Hidden
          when the calendar payload is empty (API blip or no upcoming
          holidays). */}
      {calendar.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: p.ink2 }}
            aria-expanded={expanded}
          >
            {expanded ? "Masquer" : "Voir le calendrier"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && <CalendarGrid holidays={calendar} serifClass={serifClass} />}
        </>
      )}
    </div>
  )
}

// ── Calendar grid ─────────────────────────────────────────────────

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"]
const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

interface DayHoliday {
  zone: Zone | "ALL"
  description: string
}

/**
 * Index holidays by ISO date. Each day in [start, end] (inclusive)
 * gets a list of zones-on-vacation, pre-computed once for fast
 * O(1) lookup during render.
 */
function buildDayIndex(holidays: CalendarHoliday[]): Map<string, DayHoliday[]> {
  const idx = new Map<string, DayHoliday[]>()
  for (const h of holidays) {
    const start = new Date(h.startISO + "T00:00:00")
    const end = new Date(h.endISO + "T00:00:00")
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      const list = idx.get(key) ?? []
      list.push({ zone: h.zone, description: h.description })
      idx.set(key, list)
    }
  }
  return idx
}

function CalendarGrid({
  holidays,
  serifClass,
}: {
  holidays: CalendarHoliday[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const dayIndex = useMemo(() => buildDayIndex(holidays), [holidays])

  // Render the current month + next 2.
  const months = useMemo(() => {
    const out: Array<{ year: number; month: number }> = []
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      out.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return out
  }, [])

  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${p.line}` }}>
      <div className="flex items-center gap-3 mb-3 text-[10px] font-semibold uppercase tracking-wide flex-wrap" style={{ color: p.ink2 }}>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: ZONE_COLOR.A }} /> A
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: ZONE_COLOR.B }} /> B
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: ZONE_COLOR.C }} /> C
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: ALL_ZONE_COLOR }} /> Toutes
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {months.map((m) => (
          <MonthGrid
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            dayIndex={dayIndex}
            serifClass={serifClass}
          />
        ))}
      </div>
    </div>
  )
}

function MonthGrid({
  year,
  month,
  dayIndex,
  serifClass,
}: {
  year: number
  month: number
  dayIndex: Map<string, DayHoliday[]>
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const todayISO = new Date().toISOString().slice(0, 10)
  // ISO weekday: Mon=1 … Sun=7. JS Sunday=0, so shift.
  const firstWeekday = ((new Date(year, month, 1).getDay() + 6) % 7) // 0=Mon, 6=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className={`${serifClass} text-sm font-medium mb-2`} style={{ color: p.ink }}>
        {MONTH_LABELS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] mb-1" style={{ color: p.ink2 }}>
        {WEEKDAY_LABELS.map((wl, i) => (
          <div key={i} className="text-center font-semibold">{wl}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
          const dayHolidays = dayIndex.get(iso) ?? []
          const zonesOn = new Set(dayHolidays.map((h) => h.zone))
          const isToday = iso === todayISO
          // Build small zone bar at the bottom: 3 segments (A, B, C),
          // colored when that zone is on vacation. ALL = full violet.
          const hasAll = zonesOn.has("ALL")
          const segs: Array<{ key: string; bg: string }> = hasAll
            ? [{ key: "all", bg: ALL_ZONE_COLOR }]
            : (["A", "B", "C"] as const).map((z) => ({
                key: z,
                bg: zonesOn.has(z) ? ZONE_COLOR[z] : "transparent",
              }))
          return (
            <div
              key={i}
              className="aspect-square rounded-sm flex flex-col justify-between p-0.5"
              style={{
                background: isToday ? p.bg2 : "transparent",
                border: isToday ? `1px solid ${p.accent}` : `1px solid transparent`,
              }}
              title={dayHolidays.length > 0 ? dayHolidays.map((h) => `${h.zone === "ALL" ? "Toutes" : "Zone " + h.zone}: ${h.description}`).join("\n") : undefined}
            >
              <div className="text-[9px] text-center leading-none" style={{ color: p.ink }}>
                {d}
              </div>
              <div className="flex gap-px h-1">
                {segs.map((s) => (
                  <div
                    key={s.key}
                    className="flex-1 rounded-sm"
                    style={{ background: s.bg }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
