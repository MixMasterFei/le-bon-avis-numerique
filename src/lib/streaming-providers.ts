// Shared streaming-provider normalization. Single source of truth for the
// platform strings stored in MediaItem.platforms[] — used both by the Saturday
// streaming-update cron and by the import path (so a film gets day-one platforms
// matching exactly what the filters query for). The filter UIs
// (FilterSidebar, ApercuFilterSidebar) must offer these same normalized values.
import type { TMDBWatchProviderResult } from "@/lib/tmdb"

// Map TMDB provider names → our simplified, filterable names.
export const PROVIDER_NAME_MAP: Record<string, string> = {
  "Netflix": "Netflix",
  "Netflix basic with Ads": "Netflix",
  "Amazon Prime Video": "Prime Video",
  "Disney Plus": "Disney+",
  "Canal+": "Canal+",
  "Canal+ Cinema": "Canal+",
  "myCANAL": "Canal+",
  "Apple TV Plus": "Apple TV+",
  "Apple TV": "Apple TV+",
  "France TV": "France TV",
  "france.tv": "France TV",
  "Arte": "Arte",
  "ARTE": "Arte",
  "OCS Go": "OCS",
  "OCS": "OCS",
  "Paramount Plus": "Paramount+",
  "Paramount+ Amazon Channel": "Paramount+",
  "Max": "Max",
  "Max Amazon Channel": "Max",
  "Crunchyroll": "Crunchyroll",
  "ADN": "ADN",
  "Anime Digital Network": "ADN",
  "Salto": "Salto",
  "YouTube Premium": "YouTube",
  "Google Play Movies": "Google Play",
  "Microsoft Store": "Microsoft",
}

// Providers we care about (French market).
export const RELEVANT_PROVIDERS = new Set([
  "Netflix",
  "Prime Video",
  "Disney+",
  "Canal+",
  "Apple TV+",
  "France TV",
  "Arte",
  "OCS",
  "Paramount+",
  "Max",
  "Crunchyroll",
  "ADN",
])

export function normalizeProviderName(name: string): string | null {
  if (PROVIDER_NAME_MAP[name]) return PROVIDER_NAME_MAP[name]
  if (RELEVANT_PROVIDERS.has(name)) return name
  return null
}

/** Extract normalized subscription/free platform names from a TMDB FR watch-providers payload. */
export function extractProviders(watchData: TMDBWatchProviderResult | null | undefined): string[] {
  if (!watchData) return []
  const providers = new Set<string>()
  for (const list of [watchData.flatrate, watchData.free]) {
    if (!list) continue
    for (const provider of list) {
      const normalized = normalizeProviderName(provider.provider_name)
      if (normalized) providers.add(normalized)
    }
  }
  return Array.from(providers)
}
