import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/family-settings - Get family settings for the current user
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    let familySettings = await prisma.familySettings.findUnique({
      where: { userId: session.user.id },
    })

    // If no settings exist, create default ones
    if (!familySettings) {
      familySettings = await prisma.familySettings.create({
        data: {
          userId: session.user.id,
          // Default sensitivity levels (moderate)
          defaultSensitivityViolence: 2,
          defaultSensitivityScary: 2,
          defaultSensitivitySexual: 3,
          defaultSensitivityLanguage: 2,
          defaultSensitivitySubstances: 2,
          // Default positive preferences
          defaultPreferPositiveMessages: 1,
          defaultPreferRoleModels: 1,
          defaultPreferEducational: 1,
          // Empty arrays
          blockedTopics: [],
          availablePlatforms: [],
        },
      })
    }

    return NextResponse.json({ familySettings })
  } catch (error) {
    console.error("Error fetching family settings:", error)
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// PUT /api/user/family-settings - Update family settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const {
      defaultSensitivityViolence,
      defaultSensitivityScary,
      defaultSensitivitySexual,
      defaultSensitivityLanguage,
      defaultSensitivitySubstances,
      defaultPreferPositiveMessages,
      defaultPreferRoleModels,
      defaultPreferEducational,
      blockedTopics,
      availablePlatforms,
    } = body

    // Validate sensitivity values (0-3)
    const validateSensitivity = (value: unknown): number | undefined => {
      if (value === undefined) return undefined
      const num = Number(value)
      if (isNaN(num) || num < 0 || num > 3) return undefined
      return num
    }

    // Upsert family settings
    const familySettings = await prisma.familySettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        defaultSensitivityViolence: validateSensitivity(defaultSensitivityViolence) ?? 2,
        defaultSensitivityScary: validateSensitivity(defaultSensitivityScary) ?? 2,
        defaultSensitivitySexual: validateSensitivity(defaultSensitivitySexual) ?? 3,
        defaultSensitivityLanguage: validateSensitivity(defaultSensitivityLanguage) ?? 2,
        defaultSensitivitySubstances: validateSensitivity(defaultSensitivitySubstances) ?? 2,
        defaultPreferPositiveMessages: validateSensitivity(defaultPreferPositiveMessages) ?? 1,
        defaultPreferRoleModels: validateSensitivity(defaultPreferRoleModels) ?? 1,
        defaultPreferEducational: validateSensitivity(defaultPreferEducational) ?? 1,
        blockedTopics: Array.isArray(blockedTopics) ? blockedTopics : [],
        availablePlatforms: Array.isArray(availablePlatforms) ? availablePlatforms : [],
      },
      update: {
        ...(validateSensitivity(defaultSensitivityViolence) !== undefined && {
          defaultSensitivityViolence: validateSensitivity(defaultSensitivityViolence),
        }),
        ...(validateSensitivity(defaultSensitivityScary) !== undefined && {
          defaultSensitivityScary: validateSensitivity(defaultSensitivityScary),
        }),
        ...(validateSensitivity(defaultSensitivitySexual) !== undefined && {
          defaultSensitivitySexual: validateSensitivity(defaultSensitivitySexual),
        }),
        ...(validateSensitivity(defaultSensitivityLanguage) !== undefined && {
          defaultSensitivityLanguage: validateSensitivity(defaultSensitivityLanguage),
        }),
        ...(validateSensitivity(defaultSensitivitySubstances) !== undefined && {
          defaultSensitivitySubstances: validateSensitivity(defaultSensitivitySubstances),
        }),
        ...(validateSensitivity(defaultPreferPositiveMessages) !== undefined && {
          defaultPreferPositiveMessages: validateSensitivity(defaultPreferPositiveMessages),
        }),
        ...(validateSensitivity(defaultPreferRoleModels) !== undefined && {
          defaultPreferRoleModels: validateSensitivity(defaultPreferRoleModels),
        }),
        ...(validateSensitivity(defaultPreferEducational) !== undefined && {
          defaultPreferEducational: validateSensitivity(defaultPreferEducational),
        }),
        ...(blockedTopics !== undefined && {
          blockedTopics: Array.isArray(blockedTopics) ? blockedTopics : [],
        }),
        ...(availablePlatforms !== undefined && {
          availablePlatforms: Array.isArray(availablePlatforms) ? availablePlatforms : [],
        }),
      },
    })

    return NextResponse.json({ familySettings })
  } catch (error) {
    console.error("Error updating family settings:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
