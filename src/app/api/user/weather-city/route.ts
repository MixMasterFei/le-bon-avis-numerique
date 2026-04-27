import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Per-user weather city for the Météo famille sidebar widget. Stored
 * server-side so home PC, work PC, and phone all show the same city.
 */

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ city: null })
    }
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { weatherCityName: true, weatherCityLat: true, weatherCityLon: true },
    })
    if (!u || !u.weatherCityName || u.weatherCityLat === null || u.weatherCityLon === null) {
      return NextResponse.json({ city: null })
    }
    return NextResponse.json({
      city: { name: u.weatherCityName, lat: u.weatherCityLat, lon: u.weatherCityLon },
    })
  } catch (err) {
    console.error("[/api/user/weather-city GET] failed:", err)
    return NextResponse.json({ city: null })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const body = await request.json()
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const lat = typeof body?.lat === "number" ? body.lat : NaN
    const lon = typeof body?.lon === "number" ? body.lon : NaN
    if (!name || name.length > 100 || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Ville invalide" }, { status: 400 })
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { weatherCityName: name, weatherCityLat: lat, weatherCityLon: lon },
    })
    return NextResponse.json({ city: { name, lat, lon } })
  } catch (err) {
    console.error("[/api/user/weather-city PATCH] failed:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
