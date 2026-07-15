import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWeatherForCity } from "@/lib/weather"

/**
 * Refetch weather for a given city after the user picks a new one in
 * the picker dialog. Server-side proxy keeps the open-meteo call out
 * of the client bundle and reuses the in-memory 3h cache from
 * @/lib/weather. Auth-gated because the widget is only on
 * /apercudecouverte-v3 (auth-only page).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const lat = Number(searchParams.get("lat"))
    const lon = Number(searchParams.get("lon"))
    const name = (searchParams.get("name") ?? "").trim()
    // Same bounds as the PATCH /api/user/weather-city validation — an
    // out-of-range coordinate would only waste an upstream call.
    if (
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
      !name || name.length > 100
    ) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
    }
    const snapshot = await getWeatherForCity({ name, lat, lon })
    if (!snapshot) {
      return NextResponse.json({ error: "Météo indisponible" }, { status: 502 })
    }
    return NextResponse.json({ snapshot })
  } catch (err) {
    console.error("[/api/weather GET] failed:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
