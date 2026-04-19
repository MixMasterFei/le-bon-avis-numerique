import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_ACTIONS = ["hide", "dismiss", "restore"] as const

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    const role = (session?.user as { role?: string } | undefined)?.role
    if (role !== "ADMIN" && role !== "MODERATOR") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id: reportId } = await ctx.params
    const payload = await req.json().catch(() => null)
    const action = typeof payload?.action === "string" ? payload.action : ""
    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 })
    }

    const report = await prisma.newsCommentReport.findUnique({
      where: { id: reportId },
      select: { id: true, commentId: true },
    })
    if (!report) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 })
    }

    if (action === "hide") {
      await prisma.$transaction([
        prisma.newsComment.update({
          where: { id: report.commentId },
          data: { status: "HIDDEN" },
        }),
        // Resolve every pending report on this comment — no point keeping
        // sibling reports dangling once the mod has acted.
        prisma.newsCommentReport.updateMany({
          where: { commentId: report.commentId, status: "PENDING" },
          data: { status: "RESOLVED" },
        }),
      ])
    } else if (action === "dismiss") {
      await prisma.newsCommentReport.update({
        where: { id: report.id },
        data: { status: "DISMISSED" },
      })
    } else if (action === "restore") {
      await prisma.$transaction([
        prisma.newsComment.update({
          where: { id: report.commentId },
          data: { status: "VISIBLE" },
        }),
        prisma.newsCommentReport.updateMany({
          where: { commentId: report.commentId, status: { not: "DISMISSED" } },
          data: { status: "RESOLVED" },
        }),
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error moderating news comment report:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
