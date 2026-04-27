/**
 * Weather lookup for the "Météo famille" sidebar widget on
 * /apercudecouverte-v3. Open-Meteo (no key, no rate-limit headaches
 * at our scale) provides the forecast; this lib stitches together
 * current conditions + 5-day outlook + sunset for tonight.
 *
 * Cross-device: each user's city is persisted on their User row. The
 * server reads it for SSR, the client refetches when the user picks
 * a new city through the picker dialog.
 *
 * Open-Meteo docs: https://open-meteo.com/en/docs
 */

export type WeatherCondition = "sunny" | "mixed" | "rainy" | "cold" | "snow" | "clear-night"

export interface WeatherCity {
  name: string
  lat: number
  lon: number
}

export interface WeatherDay {
  dateISO: string          // YYYY-MM-DD
  tempMaxC: number
  tempMinC: number
  condition: WeatherCondition
}

export interface WeatherCurrent {
  tempC: number
  feelsLikeC: number
  condition: WeatherCondition
  sunsetISO: string | null   // tonight's sunset, ISO datetime
}

export interface WeatherSnapshot {
  city: WeatherCity
  // Null when the upstream API failed for this snapshot but we still
  // want to render the city header + picker so the user can switch
  // away from a misconfigured city.
  current: WeatherCurrent | null
  // Today + next 4 days (5 entries). Today is index 0. Empty when
  // upstream failed.
  daily: WeatherDay[]
}

// Default city when the user hasn't picked one yet.
export const DEFAULT_CITY: WeatherCity = {
  name: "Paris",
  lat: 48.8566,
  lon: 2.3522,
}

// ── Cache (3h, keyed by rounded coordinates) ─────────────────────
// Rounded to 2 decimals so neighbouring lookups in the same city
// share a cache entry.
interface CacheEntry { fetchedAt: number; data: WeatherSnapshot | null }
const cache = new Map<string, CacheEntry>()
const CACHE_MS = 3 * 60 * 60 * 1000

function cacheKey(lat: number, lon: number, name: string): string {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}:${name}`
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number
    apparent_temperature: number
    weathercode: number
    is_day: number
  }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
    sunset: string[]
  }
}

/**
 * WMO weather code → simple condition bucket. Reference:
 * https://open-meteo.com/en/docs#weathervariables (table at the bottom).
 *
 * Family-facing buckets, not meteorological precision: parents care
 * "is it raining? cold? sunny?" not "scattered showers vs drizzle".
 */
function classify(code: number, isDay: boolean, tempMax: number): WeatherCondition {
  if (tempMax < 0 || code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return "snow"
  if (tempMax < 8) return "cold"
  if (code >= 51 && code <= 67) return "rainy"   // drizzle + freezing rain
  if (code >= 80 && code <= 82) return "rainy"   // showers
  if (code >= 95 && code <= 99) return "rainy"   // thunderstorm
  if (code === 45 || code === 48) return "mixed" // fog
  if (code >= 1 && code <= 3) return "mixed"     // partly cloudy
  if (code === 0) return isDay ? "sunny" : "clear-night"
  return "mixed"
}

export async function getWeatherForCity(city: WeatherCity): Promise<WeatherSnapshot | null> {
  const key = cacheKey(city.lat, city.lon, city.name)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit.data

  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(city.lat))
  url.searchParams.set("longitude", String(city.lon))
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weathercode,is_day")
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weathercode,sunset")
  url.searchParams.set("timezone", "auto")
  url.searchParams.set("forecast_days", "5")

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
      cache: "force-cache",
      next: { revalidate: 10800 }, // 3h
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as OpenMeteoResponse
    if (!json.current || !json.daily || !Array.isArray(json.daily.time)) {
      cache.set(key, { fetchedAt: Date.now(), data: null })
      return null
    }
    const d = json.daily
    const daily: WeatherDay[] = d.time.map((dateISO, i) => ({
      dateISO,
      tempMaxC: Math.round(d.temperature_2m_max[i]),
      tempMinC: Math.round(d.temperature_2m_min[i]),
      condition: classify(d.weathercode[i], true, d.temperature_2m_max[i]),
    }))

    const snapshot: WeatherSnapshot = {
      city,
      current: {
        tempC: Math.round(json.current.temperature_2m),
        feelsLikeC: Math.round(json.current.apparent_temperature),
        condition: classify(
          json.current.weathercode,
          json.current.is_day === 1,
          d.temperature_2m_max[0],
        ),
        sunsetISO: d.sunset[0] ?? null,
      },
      daily,
    }
    cache.set(key, { fetchedAt: Date.now(), data: snapshot })
    return snapshot
  } catch (err) {
    console.warn("[weather] fetch failed:", err)
    return cache.get(key)?.data ?? null
  }
}
