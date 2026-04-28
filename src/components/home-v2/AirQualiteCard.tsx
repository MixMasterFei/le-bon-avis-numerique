"use client"

import { Wind, Flower2 } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { AirQualitySnapshot, AqiLevel, PollenLevel } from "@/lib/air-quality"

const AQI_LABEL: Record<AqiLevel, string> = {
  good: "Bonne",
  fair: "Acceptable",
  moderate: "Moyenne",
  poor: "Mauvaise",
  "very-poor": "Très mauvaise",
}

const AQI_COLOR: Record<AqiLevel, string> = {
  good: "#B8D89A",       // sage
  fair: "#F8D775",       // amber
  moderate: "#E8A87C",   // peach
  poor: "#D89AB0",       // rose
  "very-poor": "#A79BC7", // violet
}

const POLLEN_LABEL: Record<PollenLevel, string> = {
  low: "faible",
  moderate: "modéré",
  high: "élevé",
  "very-high": "très élevé",
}

const POLLEN_COLOR: Record<PollenLevel, string> = {
  low: "#B8D89A",
  moderate: "#F8D775",
  high: "#E8A87C",
  "very-high": "#D89AB0",
}

/**
 * Sidebar widget: air quality + pollen index for the user's saved
 * city. Daily-use widget, especially relevant for families with
 * allergic kids or grandparents. Hides itself when the API failed
 * — the rest of the sidebar still renders.
 */
export function AirQualiteCard({
  snapshot,
  serifClass,
}: {
  snapshot: AirQualitySnapshot
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const aqiBg = AQI_COLOR[snapshot.aqiLevel]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.ink, color: p.bg }}
      >
        <Wind className="w-3 h-3" />
        Air & pollens · {snapshot.city.name}
      </div>

      {/* Air quality */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`${serifClass} text-3xl font-medium leading-none px-2.5 py-1 rounded-lg`}
          style={{
            background: aqiBg,
            color: "#1E1A15",
            letterSpacing: "-0.02em",
          }}
        >
          {snapshot.aqi}
        </div>
        <div className="min-w-0">
          <div className={`${serifClass} text-sm font-medium`} style={{ color: p.ink }}>
            Qualité {AQI_LABEL[snapshot.aqiLevel].toLowerCase()}
          </div>
          <div className="text-[11px]" style={{ color: p.ink2 }}>
            PM2.5 : {snapshot.pm25} µg/m³
          </div>
        </div>
      </div>

      {/* Pollen, only if at least moderate */}
      {snapshot.topPollen && (
        <div
          className="flex items-center gap-2 pt-3 text-xs"
          style={{ borderTop: `1px solid ${p.line2}`, color: p.ink }}
        >
          <Flower2 className="w-3.5 h-3.5 shrink-0" style={{ color: POLLEN_COLOR[snapshot.topPollen.level] }} />
          <span>
            Pollens de <strong>{snapshot.topPollen.labelFr.toLowerCase()}</strong> :
            {" "}
            <span style={{ color: POLLEN_COLOR[snapshot.topPollen.level], fontWeight: 600 }}>
              {POLLEN_LABEL[snapshot.topPollen.level]}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
