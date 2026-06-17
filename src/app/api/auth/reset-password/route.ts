import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/db"
import { verifyPasswordResetToken } from "@/lib/tokens"

// POST /api/auth/reset-password - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token et mot de passe requis" },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      )
    }

    // Verify the token
    const result = await verifyPasswordResetToken(token)

    if (!result) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await hash(password, 12)

    // Completing a reset proves the user controls this inbox, so treat it as
    // email verification too — otherwise a user who never verified would reset
    // their password and still be blocked at login by the unverified-email check.
    const existing = await prisma.user.findUnique({
      where: { email: result.email },
      select: { emailVerified: true },
    })

    // Update user's password
    await prisma.user.update({
      where: { email: result.email },
      data: {
        password: hashedPassword,
        emailVerified: existing?.emailVerified ?? new Date(),
      },
    })

    return NextResponse.json({
      message: "Mot de passe réinitialisé avec succès",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation" },
      { status: 500 }
    )
  }
}
