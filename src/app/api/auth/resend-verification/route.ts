import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/email"

// POST /api/auth/resend-verification - Resend verification email
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
      },
    })

    // Don't reveal if user exists or not for security
    if (!user) {
      return NextResponse.json({
        message: "Si un compte existe avec cet email, un email de vérification sera envoyé.",
      })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: "Cet email est déjà vérifié.",
        alreadyVerified: true,
      })
    }

    // Create and send new verification token
    const token = await createVerificationToken(sanitizedEmail)
    await sendVerificationEmail(sanitizedEmail, token, user.name || undefined)

    return NextResponse.json({
      message: "Email de vérification envoyé.",
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500 }
    )
  }
}
