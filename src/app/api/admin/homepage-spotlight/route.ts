import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin-session"
import { HOMEPAGE_SPOTLIGHT_TAG, getHomepageSpotlight } from "@/lib/homepage-spotlight-data"

/**
 * « À ne pas manquer cette semaine » — admin view of the band.
 *
 * GET    → active pins (admin + homepage-watch) and what the band shows now.
 * DELETE ?id=<pin id> → remove one pin; the band re-composes at once.
 *
 * ADMIN session only (never the cron credential: this route is not in
 * CRON_JOB_ROUTES). Adding pins by hand is not offered here yet — the
 * homepage-watch cron writes them; `source='admin'` rows are honoured if
 * inserted at the database.
 */

const ID_PATTERN = /^[0-9a-f-]{36}$/i

export async function GET() {
  const denied = await requireAdminSession()
  if (denied) return denied

  const now = new Date()
  let pins: Array<{
    id: string
    source: string
    rank: number
    reason: string
    startsAt: Date
    expiresAt: Date
    media: { id: string; title: string; type: string; expertAgeRec: number | null; isEnriched: boolean }
  }> = []
  let tableReady = true
  try {
    pins = await prisma.homepageSpotlight.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: [{ source: "asc" }, { rank: "asc" }],
      select: {
        id: true,
        source: true,
        rank: true,
        reason: true,
        startsAt: true,
        expiresAt: true,
        media: { select: { id: true, title: true, type: true, expertAgeRec: true, isEnriched: true } },
      },
    })
  } catch {
    // Migration 016 not applied yet: the band runs on its fallback.
    tableReady = false
  }

  const band = await getHomepageSpotlight().catch(() => [])
  return NextResponse.json({
    tableReady,
    pins,
    band: band.map((b) => ({ id: b.id, title: b.title, type: b.type, expertAgeRec: b.expertAgeRec, isProvisional: b.isProvisional, origin: b.origin })),
  })
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdminSession()
  if (denied) return denied

  const id = request.nextUrl.searchParams.get("id") ?? ""
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  }
  try {
    const { count } = await prisma.homepageSpotlight.deleteMany({ where: { id } })
    if (count === 0) return NextResponse.json({ error: "Épingle introuvable" }, { status: 404 })
    revalidateTag(HOMEPAGE_SPOTLIGHT_TAG, { expire: 0 })
    return NextResponse.json({ removed: count })
  } catch (error) {
    console.error("homepage-spotlight delete error:", error)
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 })
  }
}
