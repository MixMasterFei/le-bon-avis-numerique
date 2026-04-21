import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Feed for the "Nouveautés manga de la semaine" homepage rail.
 * Returns mangas whose latestVolumeDate lands in the past 14 days,
 * sorted most-recent first. 14 days (not 7) because the weekly cron
 * runs Sundays — a Monday visitor should still see last week's picks.
 */

export const revalidate = 300 // 5 min — cron writes, UI reads

export async function GET() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)

  const items = await prisma.mediaItem.findMany({
    where: {
      type: "MANGA",
      latestVolumeDate: { gte: cutoff },
      posterUrl: { not: null },
    },
    orderBy: { latestVolumeDate: "desc" },
    take: 12,
    select: {
      id: true,
      title: true,
      posterUrl: true,
      expertAgeRec: true,
      genres: true,
      demographic: true,
      latestVolumeDate: true,
    },
  })

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  )
}
