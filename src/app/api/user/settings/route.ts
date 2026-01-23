import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/settings - Get user's family settings
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    let settings = await prisma.familySettings.findUnique({
      where: { userId: session.user.id },
    })

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.familySettings.create({
        data: {
          userId: session.user.id,
          blur18Plus: true, // Default to blur enabled
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
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
