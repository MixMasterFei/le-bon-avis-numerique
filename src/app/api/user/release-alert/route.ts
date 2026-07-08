import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// "Prévenez-moi" subscriptions for upcoming titles. A daily cron
// (/api/cron/release-alerts) turns each un-notified alert into a bell
// notification on the media's release date.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ subscribed: false })
  const mediaId = new URL(req.url).searchParams.get("mediaId")
  if (!mediaId) return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
  const existing = await prisma.releaseAlert.findUnique({
    where: { userId_mediaId: { userId: session.user.id, mediaId } },
    select: { id: true },
  })
  return NextResponse.json({ subscribed: Boolean(existing) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Connexion requise" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const mediaId = body?.mediaId
  if (!mediaId || typeof mediaId !== "string") {
    return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
  }
  const media = await prisma.mediaItem.findUnique({ where: { id: mediaId }, select: { id: true } })
  if (!media) return NextResponse.json({ error: "Titre introuvable" }, { status: 404 })

  await prisma.releaseAlert.upsert({
    where: { userId_mediaId: { userId: session.user.id, mediaId } },
    create: { userId: session.user.id, mediaId },
    update: {}, // re-subscribing is idempotent; keep the original notifiedAt state
  })
  return NextResponse.json({ subscribed: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Connexion requise" }, { status: 401 })
  const mediaId = new URL(req.url).searchParams.get("mediaId")
  if (!mediaId) return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
  await prisma.releaseAlert.deleteMany({ where: { userId: session.user.id, mediaId } })
  return NextResponse.json({ subscribed: false })
}
