import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hydrateComment, REACTION_TYPES } from "@/lib/news-comments"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Toggle a reaction of `type` for the current user on `comment`.
 * Returns the freshly-hydrated comment so the client can update counts
 * and the viewer's own reactions in one response.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const userId = session.user.id

    const { id: commentId } = await ctx.params
    const payload = await req.json().catch(() => null)
    const type = typeof payload?.type === "string" ? payload.type : ""
    if (!(REACTION_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: "Type de réaction invalide" }, { status: 400 })
    }

    const comment = await prisma.newsComment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true },
    })
    if (!comment) {
      return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 })
    }
    if (comment.status !== "VISIBLE") {
      return NextResponse.json({ error: "Commentaire indisponible" }, { status: 409 })
    }

    // Toggle: delete if present, create if missing.
    const existing = await prisma.newsCommentReaction.findUnique({
      where: { commentId_userId_type: { commentId, userId, type } },
    })
    if (existing) {
      await prisma.newsCommentReaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.newsCommentReaction.create({
        data: { commentId, userId, type },
      })
    }

    const fresh = await prisma.newsComment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            avatarStyle: true,
            avatarSeed: true,
            avatarOptions: true,
          },
        },
        reactions: { select: { userId: true, type: true } },
      },
    })
    if (!fresh) {
      return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 })
    }

    return NextResponse.json({ comment: hydrateComment(fresh, userId) })
  } catch (error) {
    console.error("Error toggling news comment reaction:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
