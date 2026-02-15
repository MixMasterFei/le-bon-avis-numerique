import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      )
    }

    const { id } = await params

    const screenshot = await prisma.mediaScreenshot.findUnique({
      where: { id },
      select: { id: true, mediaId: true, url: true },
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: "Capture introuvable" },
        { status: 404 }
      )
    }

    await prisma.mediaScreenshot.delete({ where: { id } })

    // Renumber remaining screenshots
    const remaining = await prisma.mediaScreenshot.findMany({
      where: { mediaId: screenshot.mediaId },
      orderBy: { order: "asc" },
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await prisma.mediaScreenshot.update({
          where: { id: remaining[i].id },
          data: { order: i },
        })
      }
    }

    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "DELETE_SCREENSHOT",
        entityType: "SCREENSHOT",
        entityId: id,
        details: JSON.stringify({
          mediaId: screenshot.mediaId,
          url: screenshot.url,
        }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Screenshot delete error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    )
  }
}
