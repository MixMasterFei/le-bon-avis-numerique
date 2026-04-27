"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Search, X, Loader2 } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { WeatherCity } from "@/lib/weather"
import type { GeocodedCity } from "@/lib/weather-geocode"

const DEBOUNCE_MS = 250

/**
 * Modal dialog: pick a city for the Météo widget.
 *
 * - Search box → server-side autocomplete via /api/weather/geocode
 * - "Utilisez ma position" → browser geolocation (one-tap, opt-in,
 *   never auto-prompted on page load)
 * - Esc / backdrop click closes
 *
 * Picked city is bubbled up via onPick; the parent persists to the
 * user row + refetches weather.
 */
export function WeatherCityPicker({
  currentCity,
  onPick,
  onClose,
}: {
  currentCity: WeatherCity
  onPick: (city: { name: string; lat: number; lon: number }) => void
  onClose: () => void
}) {
  const p = APERCU_PALETTE
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeocodedCity[]>([])
  const [searching, setSearching] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Esc to close + autofocus search input.
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Debounced city search.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/weather/geocode?q=${encodeURIComponent(q)}`)
        const data = (await res.json()) as { cities?: GeocodedCity[] }
        setResults(data.cities ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [query])

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Géolocalisation indisponible sur ce navigateur.")
      return
    }
    setGeoError(null)
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `/api/weather/geocode?lat=${latitude}&lon=${longitude}`,
          )
          const data = (await res.json()) as { city?: GeocodedCity | null }
          if (data.city) {
            onPick({ name: data.city.name, lat: data.city.lat, lon: data.city.lon })
          } else {
            // Reverse-geocode failed — still let the user proceed with raw coords.
            onPick({ name: "Ma position", lat: latitude, lon: longitude })
          }
        } catch {
          setGeoError("Impossible de retrouver votre ville.")
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        setGeoLoading(false)
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Autorisation refusée. Cliquez sur le cadenas dans la barre d'adresse pour réactiver la localisation, ou recherchez votre ville à la main ci-dessous."
            : "Position indisponible. Réessayez plus tard ou recherchez votre ville à la main.",
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const cityLabel = (c: GeocodedCity): string => {
    const parts = [c.name]
    if (c.admin1 && c.admin1 !== c.name) parts.push(c.admin1)
    if (c.country) parts.push(c.country)
    return parts.join(", ")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Choisir une ville"
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: p.ink }}>
            Choisir une ville
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: p.ink }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Geolocation button */}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold mb-3 transition-opacity disabled:opacity-50"
          style={{ background: p.accent2, color: "#FFFFFF" }}
        >
          {geoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          Utiliser ma position
        </button>
        {geoError && (
          <div className="text-[12px] mb-3 px-1" style={{ color: p.accent }}>
            {geoError}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"
            style={{ color: p.ink }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher une ville…"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: p.bg2,
              color: p.ink,
              border: `1px solid ${p.line}`,
            }}
          />
          {searching && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin opacity-50"
              style={{ color: p.ink }}
            />
          )}
        </div>

        {/* Results list */}
        <div className="max-h-72 overflow-y-auto -mx-1 px-1">
          {results.length === 0 && query.trim().length >= 2 && !searching && (
            <div className="text-sm py-6 text-center" style={{ color: p.ink2 }}>
              Aucune ville trouvée.
            </div>
          )}
          {results.map((c) => {
            const isCurrent =
              c.name === currentCity.name &&
              Math.abs(c.lat - currentCity.lat) < 0.01 &&
              Math.abs(c.lon - currentCity.lon) < 0.01
            return (
              <button
                key={`${c.lat}-${c.lon}-${c.name}`}
                type="button"
                onClick={() =>
                  onPick({ name: c.name, lat: c.lat, lon: c.lon })
                }
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{
                  background: isCurrent ? p.bg2 : "transparent",
                  color: p.ink,
                }}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-[11px]" style={{ color: p.ink2 }}>
                  {[c.admin1, c.country].filter(Boolean).join(", ") || "—"}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
