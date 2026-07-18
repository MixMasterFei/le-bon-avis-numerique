/**
 * City lookup via Open-Meteo's free geocoding API. No key required,
 * returns localized French city names with country/admin context.
 *
 * Used by the city picker dialog on the Météo widget. Server-side
 * lookup keeps the API hostname out of the client bundle and lets
 * Next cache repeated queries (popular city searches stay hot).
 *
 * Open-Meteo geocoding docs:
 * https://open-meteo.com/en/docs/geocoding-api
 */

export interface GeocodedCity {
  name: string             // "Paris"
  country: string          // "France"
  admin1: string | null    // "Île-de-France" — region for disambiguation
  lat: number
  lon: number
}

interface OpenMeteoGeocode {
  results?: Array<{
    name: string
    country: string
    admin1?: string
    latitude: number
    longitude: number
  }>
}

/**
 * Build the ordered list of query strings to try, most-specific first.
 *
 * Open-Meteo prefix-matches the stored `name`, and French communes live in
 * the DB hyphenated ("Saint-Jacut-de-la-Mer", "Boulogne-Billancourt") — but
 * users type spaces ("Saint jacut de la mer") and iOS lowercases them. So we
 * also try a hyphenated form, then fall back to just the first two tokens as
 * a shorter, more forgiving prefix (which still surfaces the target commune
 * plus its siblings for the user to pick). We do NOT hyphenate blindly on the
 * only attempt — that would break genuine space-separated names ("New York").
 *
 * Exported for unit testing (pure, no network).
 */
export function buildQueryVariants(q: string): string[] {
  const variants: string[] = []
  const push = (s: string) => {
    const t = s.trim()
    if (t.length >= 2 && !variants.some((v) => v.toLowerCase() === t.toLowerCase())) {
      variants.push(t)
    }
  }

  push(q) // 1. as typed — keeps "New York", "San Francisco" working
  if (/\s/.test(q)) push(q.replace(/\s+/g, "-")) // 2. French commune form

  // 3. shorter prefix: first two tokens (hyphen + space), for long names
  //    whose full string the DB doesn't match verbatim.
  const tokens = q.split(/[\s-]+/).filter(Boolean)
  if (tokens.length > 2) {
    push(tokens.slice(0, 2).join("-"))
    push(tokens.slice(0, 2).join(" "))
  }
  return variants
}

async function fetchGeocode(name: string): Promise<GeocodedCity[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
  url.searchParams.set("name", name)
  url.searchParams.set("count", "8")
  url.searchParams.set("language", "fr")
  url.searchParams.set("format", "json")

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      cache: "force-cache",
      next: { revalidate: 86400 }, // city names rarely change — 24h
    })
    if (!res.ok) return []
    const data = (await res.json()) as OpenMeteoGeocode
    if (!Array.isArray(data.results)) return []
    return data.results.map((r) => ({
      name: r.name,
      country: r.country,
      admin1: r.admin1 ?? null,
      lat: r.latitude,
      lon: r.longitude,
    }))
  } catch (err) {
    console.warn("[weather-geocode] search failed:", err)
    return []
  }
}

export async function searchCities(query: string): Promise<GeocodedCity[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Try each query variant in turn; return the first that yields matches, so a
  // commune typed with spaces still resolves via its hyphenated / prefix form.
  for (const variant of buildQueryVariants(q)) {
    const hits = await fetchGeocode(variant)
    if (hits.length > 0) return hits
  }
  return []
}

// Reverse geocoding (lat/lon → city name) for the "Utilisez ma
// position" button. Open-Meteo doesn't expose a reverse endpoint, so
// we use BigDataCloud's free reverse-geocoding tier (no key needed).
interface BigDataCloudReverse {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
  latitude?: number
  longitude?: number
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodedCity | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
  url.searchParams.set("localityLanguage", "fr")

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as BigDataCloudReverse
    const name = data.city || data.locality
    if (!name) return null
    return {
      name,
      country: data.countryName ?? "",
      admin1: data.principalSubdivision ?? null,
      lat,
      lon,
    }
  } catch (err) {
    console.warn("[weather-geocode] reverse failed:", err)
    return null
  }
}
