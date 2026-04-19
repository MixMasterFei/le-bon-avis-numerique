import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_REASONS = ["INAPPROPRIATE", "SPAM", "HARASSMENT", "MISINFORMATION", "OTHER"] as const

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const userId = session.user.id

    const { id: commentId } = await ctx.params
    const payload = await req.json().catch(() => null)
    const reason = typeof payload?.reason === "string" ? payload.reason : ""
    const details = typeof payload?.details === "string" ? payload.details.trim().slice(0, 500) : null

    if (!(VALID_REASONS as readonly string[]).includes(reason)) {
      return NextResponse.json({ error: "Raison de signalement invalide" }, { status: 400 })
    }

    const comment = await prisma.newsComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    })
    if (!comment) {
      return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 })
    }
    if (comment.userId === userId) {
      return NextResponse.json({ error: "Impossible de signaler votre propre commentaire" }, { status: 400 })
    }

    try {
      await prisma.newsCommentReport.create({
        data: {
          commentId,
          userId,
          reason: reason as (typeof VALID_REASONS)[number],
          details: details || null,
        },
      })
    } catch (err) {
      // Unique constraint (commentId, userId) — already reported by this user
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json({ error: "Vous avez déjà signalé ce commentaire" }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Error reporting news comment:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
