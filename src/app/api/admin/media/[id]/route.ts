import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_FIELDS = [
  "title",
  "synopsisFr",
  "expertAgeRec",
  "genres",
  "officialRating",
  "director",
  "platforms",
  "topics",
  "duration",
] as const

function cleanString(input: unknown, maxLength = 5000): string | null {
  if (input === null || input === undefined) return null
  const str = String(input)
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, maxLength)
    .trim()
  return str || null
}

function cleanNumber(input: unknown, min: number, max: number): number | null {
  const num = Number(input)
  if (isNaN(num)) return null
  return Math.min(Math.max(Math.floor(num), min), max)
}

function cleanStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => String(v).replace(/\0/g, "").trim())
    .filter((v) => v.length > 0)
    .slice(0, 50)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Build update data from whitelisted fields only
    const updateData: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (body[field] === undefined) continue

      switch (field) {
        case "expertAgeRec":
          updateData[field] = cleanNumber(body[field], 0, 21)
          break
        case "duration":
          updateData[field] = cleanNumber(body[field], 0, 9999)
          break
        case "genres":
        case "platforms":
        case "topics":
          updateData[field] = cleanStringArray(body[field])
          break
        case "synopsisFr":
          updateData[field] = cleanString(body[field], 10000)
          break
        default:
          updateData[field] = cleanString(body[field], 500)
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à modifier" },
        { status: 400 }
      )
    }

    const updated = await prisma.mediaItem.update({
      where: { id },
      data: updateData,
    })

    // Log admin activity
    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "EDIT_MEDIA",
        entityType: "MEDIA",
        entityId: id,
        details: JSON.stringify({
          fields: Object.keys(updateData),
          title: updated.title,
        }),
      },
    })

    return NextResponse.json({ success: true, media: updated })
  } catch (error) {
    console.error("Admin media edit error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    )
  }
}
