/**
 * Weekend weather forecast for Paris (default city) via Open-Meteo's
 * free API — no key required, no rate-limit headaches at our scale.
 *
 * Returns the dominant condition for the upcoming Saturday + Sunday
 * so the sidebar can suggest indoor vs outdoor family activities.
 *
 * Open-Meteo docs: https://open-meteo.com/en/docs
 */

export type WeekendCondition = "sunny" | "mixed" | "rainy" | "cold" | "snow"

export interface WeekendWeather {
  condition: WeekendCondition
  saturdayTempMax: number      // °C
  sundayTempMax: number
  saturdayPrecipMm: number     // total mm forecasted
  sundayPrecipMm: number
  city: string                 // "Paris" for now
}

// ── Paris coordinates (default city — could be user-configurable later) ──
const PARIS_LAT = 48.8566
const PARIS_LON = 2.3522
const TZ = "Europe/Paris"

interface OpenMeteoResponse {
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    precipitation_sum: number[]
    weathercode: number[]
  }
}

// ── Cache (3h) ───────────────────────────────────────────────────
let cache: { fetchedAt: number; data: WeekendWeather | null } | null = null
const CACHE_MS = 3 * 60 * 60 * 1000

function nextWeekendDates(now: Date): { saturdayISO: string; sundayISO: string } {
  // ISO weekday: Mon=1 … Sun=7. Find the upcoming Saturday.
  const day = now.getDay()  // 0=Sun … 6=Sat
  const daysUntilSat = day === 6 ? 0 : (6 - day + 7) % 7
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + daysUntilSat)
  saturday.setHours(0, 0, 0, 0)
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  return { saturdayISO: fmt(saturday), sundayISO: fmt(sunday) }
}

function classify(
  satMax: number,
  sunMax: number,
  satRain: number,
  sunRain: number,
): WeekendCondition {
  const avgTemp = (satMax + sunMax) / 2
  const totalRain = satRain + sunRain
  if (avgTemp < 0) return "snow"
  if (avgTemp < 8) return "cold"
  if (totalRain > 8) return "rainy"
  if (totalRain > 2) return "mixed"
  return "sunny"
}

export async function getWeekendWeather(): Promise<WeekendWeather | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.data

  const { saturdayISO, sundayISO } = nextWeekendDates(new Date())
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(PARIS_LAT))
  url.searchParams.set("longitude", String(PARIS_LON))
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum,weathercode")
  url.searchParams.set("timezone", TZ)
  url.searchParams.set("start_date", saturdayISO)
  url.searchParams.set("end_date", sundayISO)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
      cache: "force-cache",
      next: { revalidate: 10800 }, // 3h
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as OpenMeteoResponse
    const d = json.daily
    if (!d || !Array.isArray(d.time) || d.time.length < 2) {
      cache = { fetchedAt: Date.now(), data: null }
      return null
    }
    const data: WeekendWeather = {
      condition: classify(
        d.temperature_2m_max[0],
        d.temperature_2m_max[1],
        d.precipitation_sum[0],
        d.precipitation_sum[1],
      ),
      saturdayTempMax: Math.round(d.temperature_2m_max[0]),
      sundayTempMax: Math.round(d.temperature_2m_max[1]),
      saturdayPrecipMm: d.precipitation_sum[0],
      sundayPrecipMm: d.precipitation_sum[1],
      city: "Paris",
    }
    cache = { fetchedAt: Date.now(), data }
    return data
  } catch (err) {
    console.warn("[weekend-weather] fetch failed:", err)
    return cache?.data ?? null
  }
}
