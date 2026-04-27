import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchCities, reverseGeocode } from "@/lib/weather-geocode"

/**
 * City autocomplete for the Météo widget's picker. Server-side proxy
 * so the geocoding hostname stays out of the client bundle and so we
 * inherit Next's 24h cache on the underlying lib call.
 *
 * GET /api/weather/geocode?q=Paris        — search by name
 * GET /api/weather/geocode?lat=&lon=      — reverse for "use my location"
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()
    const lat = searchParams.get("lat")
    const lon = searchParams.get("lon")

    if (lat && lon) {
      const latN = Number(lat)
      const lonN = Number(lon)
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 })
      }
      const city = await reverseGeocode(latN, lonN)
      return NextResponse.json({ city })
    }

    if (q) {
      const cities = await searchCities(q)
      return NextResponse.json({ cities })
    }

    return NextResponse.json({ cities: [] })
  } catch (err) {
    console.error("[/api/weather/geocode GET] failed:", err)
    return NextResponse.json({ cities: [] })
  }
}
