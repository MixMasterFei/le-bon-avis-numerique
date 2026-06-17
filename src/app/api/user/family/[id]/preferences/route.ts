import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MAX_FAMILY_INTERESTS } from "@/lib/family-constants"

// GET /api/user/family/[id]/preferences - Get member preferences
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        birthYear: true,
        birthMonth: true,
        avatarEmoji: true,
        favoriteGenres: true,
        dislikedGenres: true,
        sensitivityViolence: true,
        sensitivityScary: true,
        sensitivitySexual: true,
        sensitivityLanguage: true,
        sensitivitySubstances: true,
        preferPositiveMessages: true,
        preferRoleModels: true,
        preferEducational: true,
        avoidTopics: true,
        interests: true,
        useCustomSettings: true,
        preferredTones: true,
        quizVersion: true,
        quizCompletedAt: true,
      },
    })

    if (!familyMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    // If not using custom settings, get the family defaults
    let effectiveSettings = { ...familyMember }
    if (!familyMember.useCustomSettings) {
      const familySettings = await prisma.familySettings.findUnique({
        where: { userId: session.user.id },
        select: {
          defaultSensitivityViolence: true,
          defaultSensitivityScary: true,
          defaultSensitivitySexual: true,
          defaultSensitivityLanguage: true,
          defaultSensitivitySubstances: true,
          defaultPreferPositiveMessages: true,
          defaultPreferRoleModels: true,
          defaultPreferEducational: true,
          blockedTopics: true,
        },
      })

      if (familySettings) {
        effectiveSettings = {
          ...familyMember,
          sensitivityViolence: familySettings.defaultSensitivityViolence,
          sensitivityScary: familySettings.defaultSensitivityScary,
          sensitivitySexual: familySettings.defaultSensitivitySexual,
          sensitivityLanguage: familySettings.defaultSensitivityLanguage,
          sensitivitySubstances: familySettings.defaultSensitivitySubstances,
          preferPositiveMessages: familySettings.defaultPreferPositiveMessages,
          preferRoleModels: familySettings.defaultPreferRoleModels,
          preferEducational: familySettings.defaultPreferEducational,
          avoidTopics: [
            ...familyMember.avoidTopics,
            ...familySettings.blockedTopics,
          ].filter((v, i, a) => a.indexOf(v) === i), // Unique values
        }
      }
    }

    return NextResponse.json({
      member: familyMember,
      effectiveSettings,
    })
  } catch (error) {
    console.error("Error fetching member preferences:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT /api/user/family/[id]/preferences - Update member preferences
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const existingMember = await prisma.familyMember.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    const {
      favoriteGenres,
      dislikedGenres,
      sensitivityViolence,
      sensitivityScary,
      sensitivitySexual,
      sensitivityLanguage,
      sensitivitySubstances,
      preferPositiveMessages,
      preferRoleModels,
      preferEducational,
      avoidTopics,
      interests,
      useCustomSettings,
      preferredTones,
      quizVersion,
      quizCompletedAt,
    } = body

    // Validate sensitivity values (0-3)
    const validateSensitivity = (value: unknown): number | undefined => {
      if (value === undefined) return undefined
      const num = Number(value)
      if (isNaN(num) || num < 0 || num > 3) return undefined
      return num
    }

    const updatedMember = await prisma.familyMember.update({
      where: { id },
      data: {
        ...(favoriteGenres !== undefined && {
          favoriteGenres: Array.isArray(favoriteGenres) ? favoriteGenres : [],
        }),
        ...(dislikedGenres !== undefined && {
          dislikedGenres: Array.isArray(dislikedGenres) ? dislikedGenres : [],
        }),
        ...(validateSensitivity(sensitivityViolence) !== undefined && {
          sensitivityViolence: validateSensitivity(sensitivityViolence),
        }),
        ...(validateSensitivity(sensitivityScary) !== undefined && {
          sensitivityScary: validateSensitivity(sensitivityScary),
        }),
        ...(validateSensitivity(sensitivitySexual) !== undefined && {
          sensitivitySexual: validateSensitivity(sensitivitySexual),
        }),
        ...(validateSensitivity(sensitivityLanguage) !== undefined && {
          sensitivityLanguage: validateSensitivity(sensitivityLanguage),
        }),
        ...(validateSensitivity(sensitivitySubstances) !== undefined && {
          sensitivitySubstances: validateSensitivity(sensitivitySubstances),
        }),
        ...(validateSensitivity(preferPositiveMessages) !== undefined && {
          preferPositiveMessages: validateSensitivity(preferPositiveMessages),
        }),
        ...(validateSensitivity(preferRoleModels) !== undefined && {
          preferRoleModels: validateSensitivity(preferRoleModels),
        }),
        ...(validateSensitivity(preferEducational) !== undefined && {
          preferEducational: validateSensitivity(preferEducational),
        }),
        ...(avoidTopics !== undefined && {
          avoidTopics: Array.isArray(avoidTopics) ? avoidTopics : [],
        }),
        ...(interests !== undefined && {
          interests: Array.isArray(interests)
            ? interests.map((i: unknown) => String(i).trim()).filter(Boolean).slice(0, MAX_FAMILY_INTERESTS)
            : [],
        }),
        ...(useCustomSettings !== undefined && {
          useCustomSettings: Boolean(useCustomSettings),
        }),
        ...(preferredTones !== undefined && {
          preferredTones: Array.isArray(preferredTones) ? preferredTones : [],
        }),
        ...(typeof quizVersion === "number" && Number.isInteger(quizVersion) && quizVersion >= 0 && {
          quizVersion,
        }),
        ...(quizCompletedAt !== undefined && {
          quizCompletedAt: quizCompletedAt ? new Date(quizCompletedAt) : null,
        }),
      },
    })

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error("Error updating member preferences:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
