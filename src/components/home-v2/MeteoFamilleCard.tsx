"use client"

import { useState, useTransition } from "react"
import { Sun, Cloud, CloudRain, Snowflake, Wind, Moon, MapPin, Pencil } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { WeatherCondition, WeatherSnapshot } from "@/lib/weather"
import { WeatherCityPicker } from "./WeatherCityPicker"

const ICON: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  mixed: Cloud,
  rainy: CloudRain,
  cold: Wind,
  snow: Snowflake,
  "clear-night": Moon,
}

const HEADLINE: Record<WeatherCondition, string> = {
  sunny: "Beau temps",
  mixed: "Temps variable",
  rainy: "Pluie attendue",
  cold: "Temps frais",
  snow: "Risque de neige",
  "clear-night": "Ciel dégagé",
}

const WEEKDAY_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."]

function formatDayLabel(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return "Auj."
  // Parse with explicit Z + use UTC methods. Otherwise server (UTC)
  // interprets "2026-04-29T00:00:00" as UTC and client (Paris)
  // interprets it as Paris-local — different getDay() → hydration
  // mismatch.
  const d = new Date(dateISO + "T00:00:00Z")
  return WEEKDAY_FR[d.getUTCDay()]
}

function formatSunset(iso: string | null): string | null {
  if (!iso) return null
  // Open-Meteo with timezone=auto returns the sunset already in the
  // city's local clock as "2026-04-29T19:24" (no offset). Parsing
  // with new Date(iso) interprets it as the runtime's local time —
  // server (UTC) and client (Paris) get different epoch values →
  // hydration mismatch. Slice the HH:MM directly to keep it stable.
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  return `${m[1]}h${m[2]}`
}

/**
 * Sidebar widget: Météo famille — current conditions + 5-day strip +
 * weather-matched family activity ideas. City is per-user (cross-
 * device, stored on the User row). Picker dialog supports search +
 * one-tap "Utilisez ma position" for browser geolocation.
 *
 * The component receives the SSR snapshot for the user's saved city
 * (or Paris default). When the user picks a different city, we
 * refetch via /api/weather and update local state — no full page
 * reload needed.
 */
export function MeteoFamilleCard({
  initial,
  serifClass,
}: {
  initial: WeatherSnapshot
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [, startTransition] = useTransition()

  const onCityPicked = async (city: { name: string; lat: number; lon: number }) => {
    // Persist server-side so the same city syncs to other devices.
    // Refetch weather in parallel for snappier UI.
    const [, weatherRes] = await Promise.all([
      fetch("/api/user/weather-city", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(city),
      }),
      fetch(`/api/weather?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}`),
    ])
    if (weatherRes.ok) {
      const data = (await weatherRes.json()) as { snapshot?: WeatherSnapshot }
      if (data.snapshot) {
        startTransition(() => setSnapshot(data.snapshot!))
      }
    }
    setPickerOpen(false)
  }

  const current = snapshot.current
  const Icon = current ? ICON[current.condition] : Cloud
  const sunsetStr = current ? formatSunset(current.sunsetISO) : null
  const todayISO = snapshot.daily[0]?.dateISO ?? ""

  return (
    <>
      <div
        className="rounded-2xl p-5"
        style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
      >
        {/* Header — city + edit button */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: p.accent2, color: "#FFFFFF" }}
          >
            <MapPin className="w-3 h-3" />
            {snapshot.city.name}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: p.ink2 }}
            aria-label="Changer de ville"
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
        </div>

        {current ? (
          <>
            {/* Current — big temp + condition */}
            <div className="flex items-start gap-4 mb-4">
              <Icon className="w-12 h-12 shrink-0" style={{ color: p.accent2 }} strokeWidth={1.5} />
              <div className="min-w-0">
                <div
                  className={`${serifClass} text-4xl font-medium leading-none mb-1`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {current.tempC}°
                </div>
                <div className={`${serifClass} text-sm font-medium`} style={{ color: p.ink }}>
                  {HEADLINE[current.condition]}
                </div>
                <div className="text-[11px]" style={{ color: p.ink2 }}>
                  Ressenti {current.feelsLikeC}°
                  {sunsetStr ? <> · Coucher du soleil {sunsetStr}</> : null}
                </div>
              </div>
            </div>

            {/* 5-day strip */}
            {snapshot.daily.length > 0 && (
              <div className="grid grid-cols-5 gap-1.5">
                {snapshot.daily.map((d) => {
                  const DIcon = ICON[d.condition]
                  return (
                    <div key={d.dateISO} className="flex flex-col items-center gap-1">
                      <div className="text-[10px] font-semibold uppercase" style={{ color: p.ink2 }}>
                        {formatDayLabel(d.dateISO, todayISO)}
                      </div>
                      <DIcon className="w-5 h-5" style={{ color: p.ink2 }} strokeWidth={1.75} />
                      <div className="text-[11px] font-medium leading-tight text-center" style={{ color: p.ink }}>
                        {d.tempMaxC}°
                        <div className="text-[10px] opacity-60" style={{ color: p.ink2 }}>
                          {d.tempMinC}°
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm py-4" style={{ color: p.ink2 }}>
            Météo indisponible pour l&apos;instant. Essayez une autre ville.
          </div>
        )}
      </div>

      {pickerOpen && (
        <WeatherCityPicker
          currentCity={snapshot.city}
          onPick={onCityPicked}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
