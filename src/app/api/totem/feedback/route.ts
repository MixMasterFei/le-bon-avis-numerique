import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUseTotem } from "@/lib/totem/access"
import { TOTEM_SESSION_COOKIE } from "@/lib/totem/persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_RATINGS = new Set(["UP", "DOWN"])
const MAX_REASON_CHARS = 200

interface FeedbackBody {
  messageId?: string
  rating?: string
  reason?: string | null
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody
  try {
    body = (await req.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!body.messageId || typeof body.messageId !== "string") {
    return NextResponse.json({ error: "missing_messageId" }, { status: 400 })
  }
  if (!body.rating || !VALID_RATINGS.has(body.rating)) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 })
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, MAX_REASON_CHARS)
      : null

  const session = await auth()
  if (!canUseTotem({ isAuthenticated: !!session?.user, role: session?.user?.role ?? null })) {
    return NextResponse.json({ error: "totem_disabled" }, { status: 403 })
  }

  // Ownership: user must own the conversation that owns the message.
  // For anon admins this would be the session cookie; in practice Phase 2
  // is admin-gated so we always have a userId here. We still support the
  // anon code path so the ownership check is robust.
  const userId = session?.user?.id ?? null
  const sessionId = req.cookies.get(TOTEM_SESSION_COOKIE)?.value ?? null

  const message = await prisma.totemMessage.findUnique({
    where: { id: body.messageId },
    select: {
      id: true,
      role: true,
      conversation: { select: { userId: true, sessionId: true } },
    },
  })

  if (!message) {
    return NextResponse.json({ error: "message_not_found" }, { status: 404 })
  }
  if (message.role !== "assistant") {
    // Only assistant messages are feedback-able.
    return NextResponse.json({ error: "not_assistant_message" }, { status: 400 })
  }

  const ownsAuth = userId && message.conversation.userId === userId
  const ownsAnon = !userId && sessionId && !message.conversation.userId && message.conversation.sessionId === sessionId
  if (!ownsAuth && !ownsAnon) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // One vote per messageId — schema has no userId column, and each
  // message belongs to a single user via its conversation. Update if
  // the row exists, create otherwise.
  const existing = await prisma.totemFeedback.findFirst({
    where: { messageId: body.messageId },
    select: { id: true },
  })

  if (existing) {
    await prisma.totemFeedback.update({
      where: { id: existing.id },
      data: { rating: body.rating, reason },
    })
  } else {
    await prisma.totemFeedback.create({
      data: { messageId: body.messageId, rating: body.rating, reason },
    })
  }

  return NextResponse.json({ ok: true, rating: body.rating })
}
