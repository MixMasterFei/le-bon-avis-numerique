import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"

const MEDIA_ID = "2a7f0579-f70d-4717-a0aa-d2b4838492f1"
const SEO_TITLE = "Spider-Man: Brand New Day — À partir de quel âge ? Dès 12 ans"

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const before = await prisma.mediaItem.findUnique({
    where: { id: MEDIA_ID },
    select: { id: true, title: true, seoTitle: true },
  })

  if (!before) {
    return NextResponse.json({ error: "Media not found", id: MEDIA_ID }, { status: 404 })
  }

  const updated = await prisma.mediaItem.update({
    where: { id: MEDIA_ID },
    data: { seoTitle: SEO_TITLE },
    select: { id: true, title: true, seoTitle: true },
  })

  return NextResponse.json({
    success: true,
    before: { title: before.title, seoTitle: before.seoTitle },
    after: { title: updated.title, seoTitle: updated.seoTitle },
  })
}
