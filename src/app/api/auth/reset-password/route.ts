import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/db"
import { verifyPasswordResetToken } from "@/lib/tokens"

// POST /api/auth/reset-password - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
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

    const hashedPassword = await hash(password, 12)

    // Consume the one-time token and replace the password atomically. A failed
    // database update leaves the token usable for a retry. auth-session binds
    // every JWT to the previous hash, so this also revokes all prior sessions.
    const reset = await prisma.$transaction(async (tx) => {
      const result = await verifyPasswordResetToken(token, tx)
      if (!result) return false

      await tx.user.update({
        where: { email: result.email },
        data: { password: hashedPassword },
      })
      return true
    })

    if (!reset) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400 }
      )
    }

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
