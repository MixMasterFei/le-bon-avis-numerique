"use client"

import { useEffect, useState, useTransition } from "react"
import { Sun, Cloud, CloudRain, Snowflake, Wind, Moon, MapPin, Pencil, Loader2, X } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { WeatherCondition, WeatherSnapshot } from "@/lib/weather"
import { WeatherCityPicker } from "./WeatherCityPicker"

// Local-storage key: marks the geolocation consent prompt as
// dismissed (or already answered) so we never re-pester the user.
// Survives device-level browser permission decisions — even if the
// user revokes geolocation later, we don't re-prompt automatically.
const GEO_PROMPT_DISMISSED_KEY = "apercu-meteo-geo-prompted"

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
  hasUserCity,
  serifClass,
}: {
  initial: WeatherSnapshot
  hasUserCity: boolean
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [, startTransition] = useTransition()
  // Geolocation consent prompt — only shown to users still on the
  // Paris default. Hydrated from localStorage on mount so a returning
  // user who already dismissed the prompt doesn't see it again.
  const [showGeoPrompt, setShowGeoPrompt] = useState(false)
  const [geoPromptLoading, setGeoPromptLoading] = useState(false)
  const [geoPromptError, setGeoPromptError] = useState<string | null>(null)

  useEffect(() => {
    if (hasUserCity) return
    try {
      if (window.localStorage.getItem(GEO_PROMPT_DISMISSED_KEY)) return
    } catch {
      // Private mode / quota — fail open and show the prompt.
    }
    setShowGeoPrompt(true)
  }, [hasUserCity])

  const dismissGeoPrompt = () => {
    setShowGeoPrompt(false)
    try {
      window.localStorage.setItem(GEO_PROMPT_DISMISSED_KEY, "1")
    } catch {
      // Ignore — same fail-open rationale as above.
    }
  }

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

  // Inline geolocation handler for the consent prompt. Mirrors the
  // picker's flow but stays in-card so the user doesn't need to open
  // the modal first. Reverse-geocode falls back to raw coords if the
  // lookup fails — a snapshot at the right place beats no snapshot.
  const acceptGeoPrompt = () => {
    if (!("geolocation" in navigator)) {
      setGeoPromptError("Géolocalisation indisponible sur ce navigateur.")
      return
    }
    setGeoPromptError(null)
    setGeoPromptLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(`/api/weather/geocode?lat=${latitude}&lon=${longitude}`)
          const data = (await res.json()) as { city?: { name: string; lat: number; lon: number } | null }
          const city = data.city
            ? { name: data.city.name, lat: data.city.lat, lon: data.city.lon }
            : { name: "Ma position", lat: latitude, lon: longitude }
          await onCityPicked(city)
          dismissGeoPrompt()
        } catch {
          setGeoPromptError("Impossible de récupérer la météo locale. Réessayez plus tard.")
        } finally {
          setGeoPromptLoading(false)
        }
      },
      (err) => {
        setGeoPromptLoading(false)
        setGeoPromptError(
          err.code === err.PERMISSION_DENIED
            ? "Autorisation refusée. Vous pouvez choisir votre ville à la main avec « Modifier »."
            : "Position indisponible. Réessayez plus tard ou choisissez votre ville.",
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
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

        {/* Geolocation consent prompt — one-time, only when the user
            is still on the Paris default. Triggers the browser
            permission prompt on click; never auto-fires the API. */}
        {showGeoPrompt && (
          <div
            className="rounded-xl p-3 mb-3 relative"
            style={{ background: p.bg, border: `1px solid ${p.line2}` }}
          >
            <button
              type="button"
              onClick={dismissGeoPrompt}
              aria-label="Ignorer la demande de localisation"
              className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: p.ink2 }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className={`${serifClass} text-sm font-medium pr-6`} style={{ color: p.ink }}>
              Météo locale
            </div>
            <div className="text-[12px] mt-0.5 mb-2" style={{ color: p.ink2 }}>
              Autorisez la localisation pour afficher la météo de votre ville plutôt que celle de Paris.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={acceptGeoPrompt}
                disabled={geoPromptLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity disabled:opacity-50"
                style={{ background: p.accent2, color: "#FFFFFF" }}
              >
                {geoPromptLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                Activer la localisation
              </button>
              <button
                type="button"
                onClick={dismissGeoPrompt}
                className="text-[12px] font-medium opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: p.ink2 }}
              >
                Plus tard
              </button>
            </div>
            {geoPromptError && (
              <div className="text-[11px] mt-2" style={{ color: p.accent }}>
                {geoPromptError}
              </div>
            )}
          </div>
        )}

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
