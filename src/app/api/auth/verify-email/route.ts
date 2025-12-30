import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyToken } from "@/lib/tokens"

// POST /api/auth/verify-email - Verify email with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: "Token requis" },
        { status: 400 }
      )
    }

    // Verify the token
    const result = await verifyToken(token)

    if (!result) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400 }
      )
    }

    // Update user's email verification status
    const user = await prisma.user.update({
      where: { email: result.email },
      data: { emailVerified: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
      },
    })

    return NextResponse.json({
      message: "Email vérifié avec succès",
      user,
    })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    )
  }
}
