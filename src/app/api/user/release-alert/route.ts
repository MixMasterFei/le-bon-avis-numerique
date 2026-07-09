import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"

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
  const media = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    select: { id: true, title: true, type: true, releaseDate: true },
  })
  if (!media) return NextResponse.json({ error: "Titre introuvable" }, { status: 404 })

  // The date to fire on: prefer the card's FR availability date (body.releaseDate)
  // — MediaItem.releaseDate is the TMDB primary date and is often earlier/wrong
  // for France. Fall back to the stored date ONLY if it's in the future (never a
  // stale past date, which would fire immediately and wrongly say "disponible").
  const now = new Date()
  let notifyAt: Date | null = null
  if (typeof body?.releaseDate === "string") {
    const d = new Date(body.releaseDate)
    if (!Number.isNaN(d.getTime())) notifyAt = d
  }
  if (!notifyAt && media.releaseDate && media.releaseDate > now) notifyAt = media.releaseDate

  // Only notify on a NEW subscription (not a re-toggle), so the bell confirms
  // the action once without spamming.
  const already = await prisma.releaseAlert.findUnique({
    where: { userId_mediaId: { userId: session.user.id, mediaId } },
    select: { id: true },
  })

  await prisma.releaseAlert.upsert({
    where: { userId_mediaId: { userId: session.user.id, mediaId } },
    create: { userId: session.user.id, mediaId, notifyAt },
    update: { notifyAt }, // correct a stale/missing date on re-subscribe
  })

  if (!already) {
    // Immediate confirmation in the bell — "you're now waiting for X".
    const dateStr = notifyAt
      ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(notifyAt)
      : null
    await createNotification({
      userId: session.user.id,
      type: NOTIFICATION_TYPES.MAJOR_RELEASE,
      priority: "NORMAL",
      title: `Vous suivez « ${media.title} »`,
      body: dateStr
        ? `C'est noté — je vous préviens ici dès sa sortie, le ${dateStr}.`
        : "C'est noté — je vous préviens ici dès sa sortie.",
      href: `/media/${toMediaRouteId(media.type as MediaType, media.id)}`,
      metadata: { mediaId: media.id, kind: "subscribed" },
    }).catch(() => {}) // never fail the subscription on a notification hiccup
  }

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
