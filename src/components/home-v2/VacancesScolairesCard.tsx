"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { NextHoliday, Zone } from "@/lib/school-holidays"

interface SerializableHoliday {
  description: string
  startISO: string
  endISO: string
  zone: Zone
  daysUntilStart: number
  isOngoing: boolean
}

export function holidayToSerializable(h: NextHoliday | null): SerializableHoliday | null {
  if (!h) return null
  return {
    description: h.description,
    startISO: h.startDate.toISOString(),
    endISO: h.endDate.toISOString(),
    zone: h.zone,
    daysUntilStart: h.daysUntilStart,
    isOngoing: h.isOngoing,
  }
}

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
  serifClass,
}: {
  initialFR: SerializableHoliday | null   // Zone B (default)
  initialZoneA: SerializableHoliday | null
  initialZoneC: SerializableHoliday | null
  serifClass: string
}) {
  const p = APERCU_PALETTE
  // Lazy-init from localStorage so the user's last zone choice sticks.
  const [zone, setZone] = useState<Zone>(() => {
    if (typeof window === "undefined") return "B"
    const stored = window.localStorage.getItem("totem.holidayZone")
    return stored === "A" || stored === "B" || stored === "C" ? stored : "B"
  })

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
                aria-selected={active}
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
    </div>
  )
}
