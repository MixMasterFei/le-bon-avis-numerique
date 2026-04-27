/**
 * French school holidays — fetched from data.gouv.fr's official open
 * dataset (Ministry of Education) with a 24h in-memory cache.
 *
 * Data source: https://data.education.gouv.fr/explore/dataset/fr-en-calendrier-scolaire/
 *
 * The API returns one record per (vacances, zone) combination. We keep
 * only future-dated holidays for the requested zone and return the
 * nearest one.
 */

export type Zone = "A" | "B" | "C"

export interface NextHoliday {
  description: string  // "Vacances de printemps", "Vacances d'été", etc.
  startDate: Date
  endDate: Date
  zone: Zone
  daysUntilStart: number  // -1 if currently on holiday
  isOngoing: boolean
}

// Serialized form for crossing the RSC boundary. The card component is
// a client component, so Date can't go through the network payload as
// a Date — convert to ISO strings on the server first. Lives here (not
// in the card file) because the card is "use client" and any export
// from there gets tagged client-only.
export interface SerializableHoliday {
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

// ── Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  fetchedAt: number
  holidays: RawHoliday[]
}

interface RawHoliday {
  description: string
  start_date: string
  end_date: string
  zones: string  // "Zone A" | "Zone B" | "Zone C" | "Toutes zones"
}

let cache: CacheEntry | null = null
const CACHE_MS = 24 * 60 * 60 * 1000  // 24h

const API_URL =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=100&order_by=start_date"

async function fetchHolidays(): Promise<RawHoliday[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return cache.holidays
  }
  try {
    const res = await fetch(API_URL, {
      signal: AbortSignal.timeout(8000),
      // Server-side fetch — Next caches at the layer above, but we
      // also keep the in-memory cache for the same Lambda instance.
      cache: "force-cache",
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { results?: RawHoliday[] }
    const holidays = Array.isArray(data.results) ? data.results : []
    cache = { fetchedAt: Date.now(), holidays }
    return holidays
  } catch (err) {
    console.warn("[school-holidays] fetch failed:", err)
    // On failure, return the previous cache if we have one — better
    // stale data than an empty widget.
    return cache?.holidays ?? []
  }
}

function matchesZone(rowZones: string, requested: Zone): boolean {
  if (rowZones.toLowerCase().includes("toutes zones")) return true
  if (rowZones.toLowerCase().includes(`zone ${requested.toLowerCase()}`)) return true
  return false
}

/**
 * Returns the next or currently-ongoing holiday for the requested zone.
 * Returns null if the API failed and we have no cached data.
 */
export async function getNextHoliday(zone: Zone = "B"): Promise<NextHoliday | null> {
  const holidays = await fetchHolidays()
  if (holidays.length === 0) return null

  const now = new Date()
  const candidates = holidays
    .filter((h) => matchesZone(h.zones, zone))
    .map((h) => {
      const startDate = new Date(h.start_date)
      const endDate = new Date(h.end_date)
      return { ...h, startDate, endDate }
    })
    // Keep holidays that haven't ended yet (covers ongoing + future).
    .filter((h) => h.endDate.getTime() > now.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const next = candidates[0]
  if (!next) return null

  const isOngoing = next.startDate.getTime() <= now.getTime()
  const msUntil = next.startDate.getTime() - now.getTime()
  const daysUntilStart = isOngoing ? -1 : Math.ceil(msUntil / (24 * 60 * 60 * 1000))

  return {
    description: next.description,
    startDate: next.startDate,
    endDate: next.endDate,
    zone,
    daysUntilStart,
    isOngoing,
  }
}
