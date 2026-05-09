import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUseTotem } from "@/lib/totem/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }
  if (!canUseTotem({ isAuthenticated: true, role: session.user.role ?? null })) {
    return NextResponse.json({ error: "totem_disabled" }, { status: 403 })
  }

  const { id } = await params
  const conversation = await prisma.totemConversation.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // Cascade deletes messages + feedback (onDelete: Cascade in schema).
  await prisma.totemConversation.delete({ where: { id } })
  return NextResponse.json({ ok: true, id })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }
  if (!canUseTotem({ isAuthenticated: true, role: session.user.role ?? null })) {
    return NextResponse.json({ error: "totem_disabled" }, { status: 403 })
  }

  const { id } = await params

  const conversation = await prisma.totemConversation.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      lastMessageAt: true,
      sourcePage: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // Surface only user + assistant turns in the replay (skip raw tool
  // messages; their text content isn't user-facing anyway).
  const messages = conversation.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content && m.content.trim().length > 0)

  return NextResponse.json({
    id: conversation.id,
    startedAt: conversation.startedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    sourcePage: conversation.sourcePage,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}
