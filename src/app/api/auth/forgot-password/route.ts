import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createPasswordResetToken } from "@/lib/tokens"
import { sendPasswordResetEmail } from "@/lib/email"

// POST /api/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      )
    }

    const sanitizedEmail = email.toLowerCase().trim()

    // Find user - but don't reveal if they exist
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true, // Check if they use password auth
      },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "Si un compte existe avec cet email, un lien de réinitialisation sera envoyé.",
      })
    }

    // Only send reset email if user has a password (credentials auth)
    // OAuth users don't need password reset
    if (!user.password) {
      return NextResponse.json({
        message: "Si un compte existe avec cet email, un lien de réinitialisation sera envoyé.",
      })
    }

    // Create and send password reset token
    const token = await createPasswordResetToken(sanitizedEmail)
    await sendPasswordResetEmail(sanitizedEmail, token, user.name || undefined)

    return NextResponse.json({
      message: "Si un compte existe avec cet email, un lien de réinitialisation sera envoyé.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500 }
    )
  }
}
