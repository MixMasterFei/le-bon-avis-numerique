import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function parseLimit(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? "20")
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 50) : 20
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    const limit = parseLimit(request)
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          priority: true,
          title: true,
          body: true,
          href: true,
          metadata: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ])

    return NextResponse.json({ items, unreadCount })
  } catch (error) {
    console.error("Get notifications error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const action = typeof payload?.action === "string" ? payload.action : ""

    if (action === "mark-read") {
      const id = typeof payload?.id === "string" ? payload.id : ""
      if (!id) {
        return NextResponse.json({ error: "id requis" }, { status: 400 })
      }
      await prisma.notification.updateMany({
        where: { id, userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      })
    } else if (action === "mark-all-read") {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      })
    } else {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 })
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    })

    return NextResponse.json({ success: true, unreadCount })
  } catch (error) {
    console.error("Update notifications error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
