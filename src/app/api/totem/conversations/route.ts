import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUseTotem } from "@/lib/totem/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CONVERSATIONS = 50

function previewFromContent(content: string | undefined): string {
  if (!content) return "Conversation"
  const trimmed = content.trim().replace(/\s+/g, " ")
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 79)}…`
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }
  if (!canUseTotem({ isAuthenticated: true, role: session.user.role ?? null })) {
    return NextResponse.json({ error: "totem_disabled" }, { status: 403 })
  }

  const conversations = await prisma.totemConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { lastMessageAt: "desc" },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      startedAt: true,
      lastMessageAt: true,
      sourcePage: true,
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
      _count: {
        select: { messages: true },
      },
    },
  })

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      startedAt: c.startedAt.toISOString(),
      lastMessageAt: c.lastMessageAt.toISOString(),
      sourcePage: c.sourcePage,
      messageCount: c._count.messages,
      preview: previewFromContent(c.messages[0]?.content),
    })),
  })
}
