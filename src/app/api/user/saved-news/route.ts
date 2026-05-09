import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "12")
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 12

    const rows = await prisma.newsSavedStory.findMany({
      where: { userId: session.user.id },
      include: {
        newsStory: {
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            category: true,
            imageUrl: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    const items = rows.map((row) => ({
      id: row.id,
      savedAt: row.createdAt,
      readAt: row.readAt,
      story: row.newsStory,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Get saved news error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
