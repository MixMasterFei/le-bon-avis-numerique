import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hydrateComment, validateBody } from "@/lib/news-comments"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await ctx.params
    const existing = await prisma.newsComment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 })
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
    }
    if (existing.status !== "VISIBLE") {
      return NextResponse.json({ error: "Commentaire non modifiable" }, { status: 409 })
    }

    const payload = await req.json().catch(() => null)
    const validated = validateBody(payload?.body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const updated = await prisma.newsComment.update({
      where: { id },
      data: {
        body: validated.body,
        editedAt: new Date(),
      },
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

    return NextResponse.json({ comment: hydrateComment(updated, session.user.id) })
  } catch (error) {
    console.error("Error editing news comment:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await ctx.params
    const existing = await prisma.newsComment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 })
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
    }

    // Soft delete — keeps row for audit; UI renders as tombstone.
    await prisma.newsComment.update({
      where: { id },
      data: { status: "DELETED" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting news comment:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
