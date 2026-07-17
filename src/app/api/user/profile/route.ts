import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeFamilyName } from "@/lib/family-name"
import { isMissingColumnError } from "@/lib/prisma-errors"

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { name, familyName, image, avatarStyle, avatarSeed, avatarOptions } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Nom invalide" }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    // Display family name ("Famille Dupont" in the header + homepage
    // greeting). Empty string clears it back to the `name` fallback.
    // Plain Unicode, NOT HTML-escaped: entities would corrupt legitimate
    // French names ("O'Connor" → "O&#x27;Connor" rendered literally by
    // React). React escapes contextually at render time.
    if (familyName !== undefined) {
      if (familyName === null || (typeof familyName === "string" && familyName.trim() === "")) {
        updateData.familyName = null
      } else if (typeof familyName === "string") {
        // One word, capped (src/lib/family-name.ts) — same rule as the client
        // input, so the header pill and greeting can't be broken by a long or
        // multi-word value posted directly to the API.
        const clean = normalizeFamilyName(familyName)
        if (!clean) return NextResponse.json({ error: "Nom de famille invalide" }, { status: 400 })
        updateData.familyName = clean
      } else {
        return NextResponse.json({ error: "Nom de famille invalide" }, { status: 400 })
      }
    }

    if (image !== undefined) {
      updateData.image = image
    }

    // DiceBear avatar fields
    if (avatarStyle !== undefined) {
      updateData.avatarStyle = typeof avatarStyle === "string" ? avatarStyle.slice(0, 50) : null
    }
    if (avatarSeed !== undefined) {
      updateData.avatarSeed = typeof avatarSeed === "string" ? avatarSeed.slice(0, 50) : null
    }
    if (avatarOptions !== undefined) {
      updateData.avatarOptions = avatarOptions ?? null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, familyName: true, email: true, image: true, avatarStyle: true, avatarSeed: true, avatarOptions: true },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

const PROFILE_SELECT = {
  id: true,
  name: true,
  familyName: true,
  email: true,
  image: true,
  role: true,
  createdAt: true,
  avatarStyle: true,
  avatarSeed: true,
  avatarOptions: true,
} as const

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    let user
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: PROFILE_SELECT,
      })
    } catch (err) {
      // Deploy-order guard, NARROW: only a missing family_name column
      // (P2022 — sql/add_family_name.sql not applied) falls back to the
      // legacy shape. Any other DB failure is real and must bubble.
      if (!isMissingColumnError(err)) throw err
      const { familyName: _omit, ...legacySelect } = PROFILE_SELECT
      void _omit
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: legacySelect,
      })
      if (user) user = { ...user, familyName: null }
    }

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation" },
      { status: 500 }
    )
  }
}
