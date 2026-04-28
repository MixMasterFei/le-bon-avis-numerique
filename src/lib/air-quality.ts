/**
 * Air quality + pollen for the news page sidebar. Uses Open-Meteo's
 * free Air Quality API — same provider as the weather widget, no key
 * required, identical lat/lon contract.
 *
 * Open-Meteo docs: https://open-meteo.com/en/docs/air-quality-api
 */

import type { WeatherCity } from "@/lib/weather"

export type AqiLevel = "good" | "fair" | "moderate" | "poor" | "very-poor"
export type PollenLevel = "low" | "moderate" | "high" | "very-high"

export interface PollenReading {
  // Internal key used for rendering; matches the Open-Meteo field name.
  key: "alder" | "birch" | "grass" | "mugwort" | "olive" | "ragweed"
  labelFr: string
  value: number      // grains / m³
  level: PollenLevel
}

export interface AirQualitySnapshot {
  city: WeatherCity
  aqi: number              // European AQI (0-100+)
  aqiLevel: AqiLevel
  pm25: number             // µg/m³
  // Highest-level pollen reading today, or null when all are low /
  // out of season. Only one is shown — keeps the widget compact.
  topPollen: PollenReading | null
}

const POLLEN_LABELS: Record<PollenReading["key"], string> = {
  alder: "Aulne",
  birch: "Bouleau",
  grass: "Graminées",
  mugwort: "Armoise",
  olive: "Olivier",
  ragweed: "Ambroisie",
}

// Empirical thresholds (RNSA-aligned) — 0 / low / moderate / high.
// Values vary by species; using grass as the conservative reference.
function classifyPollen(value: number): PollenLevel {
  if (value < 5) return "low"
  if (value < 30) return "moderate"
  if (value < 80) return "high"
  return "very-high"
}

function classifyAqi(aqi: number): AqiLevel {
  if (aqi < 20) return "good"
  if (aqi < 40) return "fair"
  if (aqi < 60) return "moderate"
  if (aqi < 80) return "poor"
  return "very-poor"
}

interface OpenMeteoAirResponse {
  current?: {
    european_aqi?: number
    pm2_5?: number
    alder_pollen?: number
    birch_pollen?: number
    grass_pollen?: number
    mugwort_pollen?: number
    olive_pollen?: number
    ragweed_pollen?: number
  }
}

// 3h cache, keyed by rounded coordinates.
interface CacheEntry { fetchedAt: number; data: AirQualitySnapshot | null }
const cache = new Map<string, CacheEntry>()
const CACHE_MS = 3 * 60 * 60 * 1000

function cacheKey(c: WeatherCity): string {
  return `${c.lat.toFixed(2)}:${c.lon.toFixed(2)}`
}

export async function getAirQualityForCity(city: WeatherCity): Promise<AirQualitySnapshot | null> {
  const key = cacheKey(city)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit.data

  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality")
  url.searchParams.set("latitude", String(city.lat))
  url.searchParams.set("longitude", String(city.lon))
  url.searchParams.set(
    "current",
    "european_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
  )
  url.searchParams.set("timezone", "auto")

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
      cache: "force-cache",
      next: { revalidate: 10800 }, // 3h
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as OpenMeteoAirResponse
    const c = json.current
    if (!c || typeof c.european_aqi !== "number") {
      cache.set(key, { fetchedAt: Date.now(), data: null })
      return null
    }

    const pollens: PollenReading[] = (
      ["alder", "birch", "grass", "mugwort", "olive", "ragweed"] as const
    )
      .map((k) => {
        const value = c[`${k}_pollen` as const]
        if (typeof value !== "number" || value <= 0) return null
        return {
          key: k,
          labelFr: POLLEN_LABELS[k],
          value,
          level: classifyPollen(value),
        }
      })
      .filter((p): p is PollenReading => p !== null)
      .sort((a, b) => b.value - a.value)

    // Show the top pollen only if it's at least "moderate" — silence
    // out-of-season trace amounts so the widget isn't noisy.
    const topPollen =
      pollens[0] && (pollens[0].level === "high" || pollens[0].level === "very-high" || pollens[0].level === "moderate")
        ? pollens[0]
        : null

    const snapshot: AirQualitySnapshot = {
      city,
      aqi: Math.round(c.european_aqi),
      aqiLevel: classifyAqi(c.european_aqi),
      pm25: typeof c.pm2_5 === "number" ? Math.round(c.pm2_5) : 0,
      topPollen,
    }
    cache.set(key, { fetchedAt: Date.now(), data: snapshot })
    return snapshot
  } catch (err) {
    console.warn("[air-quality] fetch failed:", err)
    return cache.get(key)?.data ?? null
  }
}
