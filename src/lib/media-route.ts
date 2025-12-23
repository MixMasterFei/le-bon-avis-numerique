import type { MockMediaItem } from "@/lib/mock-data"

export type MediaType = MockMediaItem["type"]

/**
 * Route id format: `<type>:<encodedId>`
 * - type is lowercased ("movie", "tv", ...)
 * - id is encodeURIComponent(...) so it can safely include special chars
 */
export function toMediaRouteId(type: MediaType, id: string): string {
  return `${type.toLowerCase()}:${encodeURIComponent(id)}`
}

export function parseMediaRouteId(routeId: string): { type: MediaType | null; id: string } {
  // Next.js params may provide percent-encoded segments (e.g. "movie%3A123"),
  // so decode the whole segment first, then parse.
  let decodedRouteId = routeId
  try {
    decodedRouteId = decodeURIComponent(routeId)
  } catch {
    // keep raw
  }

  const sepIdx = decodedRouteId.indexOf(":")
  if (sepIdx === -1) return { type: null, id: decodedRouteId }

  const rawType = decodedRouteId.slice(0, sepIdx).toUpperCase()
  const decodedId = decodedRouteId.slice(sepIdx + 1)

  const type =
    rawType === "MOVIE" || rawType === "TV" || rawType === "GAME" || rawType === "BOOK" || rawType === "APP"
      ? (rawType as MediaType)
      : null

  return { type, id: decodedId }
}


