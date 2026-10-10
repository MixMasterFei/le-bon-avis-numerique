import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/settings - Get user's family settings
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      // Return safe defaults for non-authenticated users (no 500)
      return NextResponse.json({ settings: { blur18Plus: true } })
    }

    // Read-or-create in ONE statement. The old findUnique → create raced:
    // two concurrent first-visit GETs (SettingsContext + /profil, or this
    // route + /api/user/family-settings) both saw no row and both inserted,
    // and the loser hit P2002 on the user_id unique. `update: {}` leaves an
    // existing row untouched, so this is a pure "get, creating defaults once".
    const settings = await prisma.familySettings.upsert({
      where: { userId: session.user.id },
      update: {},
      create: {
        userId: session.user.id,
        blur18Plus: true, // Default to blur enabled
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    // Return safe defaults instead of 500 — settings are non-critical
    return NextResponse.json({ settings: { blur18Plus: true } })
  }
}

// PATCH /api/user/settings - Update user's family settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { blur18Plus } = body

    // Upsert settings (create if doesn't exist, update if exists)
    const settings = await prisma.familySettings.upsert({
      where: { userId: session.user.id },
      update: {
        ...(blur18Plus !== undefined && { blur18Plus }),
      },
      create: {
        userId: session.user.id,
        blur18Plus: blur18Plus ?? true,
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
