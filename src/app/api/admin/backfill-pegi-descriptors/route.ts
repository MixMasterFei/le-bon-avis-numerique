import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGameDetails, getPegiInfo } from "@/lib/igdb"

export const maxDuration = 60

/**
 * Backfill PEGI age + pegi_descriptors[] from IGDB for games that have an
 * igdbId but are missing a rating / descriptors. This re-fetches via the
 * (now-fixed) IGDB age-rating query, so games imported during the broken-query
 * era finally get their PEGI populated.
 *
 * Cursor-paginated: pass ?afterId=<id> to advance through the catalog by id.
 * Games that genuinely have no PEGI on IGDB keep officialRating=null, so we
 * MUST advance by cursor rather than always re-selecting the lowest null ids
 * (otherwise a chunked loop would spin forever on them).
 *
 * POST ?limit=30&afterId=<id>&dry=true
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get("limit") || "30", 10) || 30)
  const dryRun = request.nextUrl.searchParams.get("dry") === "true"
  const afterId = request.nextUrl.searchParams.get("afterId") || undefined

  const items = await prisma.mediaItem.findMany({
    where: {
      type: "GAME",
      igdbId: { not: null },
      OR: [{ pegiDescriptors: { isEmpty: true } }, { officialRating: null }],
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    select: { id: true, title: true, igdbId: true, officialRating: true, pegiDescriptors: true },
    orderBy: { id: "asc" },
    take: limit,
  })

  let updated = 0
  let errors = 0
  const changes: string[] = []

  for (const item of items) {
    try {
      const game = await getGameDetails(item.igdbId!)
      if (!game) {
        errors++
        changes.push(`${item.title}: IGDB introuvable`)
        continue
      }
      const pegi = getPegiInfo(game.age_ratings)
      const descriptors = pegi?.descriptors ?? []
      const officialRating = pegi?.internal ?? item.officialRating

      if (
        descriptors.length === item.pegiDescriptors.length &&
        descriptors.every((d, i) => d === item.pegiDescriptors[i]) &&
        officialRating === item.officialRating
      ) {
        changes.push(`${item.title}: inchangé`)
        continue
      }

      if (!dryRun) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            pegiDescriptors: descriptors,
            ...(officialRating ? { officialRating } : {}),
          },
        })
      }
      updated++
      changes.push(
        `${item.title}: ${item.pegiDescriptors.length}→${descriptors.length} descripteurs` +
          (officialRating && officialRating !== item.officialRating ? ` · ${officialRating}` : ""),
      )
    } catch (e) {
      errors++
      changes.push(`${item.title}: ${e instanceof Error ? e.message : "erreur"}`)
    }
  }

  // Cursor advances by id; we're done once a page comes back short.
  const lastId = items.length > 0 ? items[items.length - 1].id : null
  const done = items.length < limit

  const remaining = await prisma.mediaItem.count({
    where: {
      type: "GAME",
      igdbId: { not: null },
      OR: [{ pegiDescriptors: { isEmpty: true } }, { officialRating: null }],
      ...(lastId ? { id: { gt: lastId } } : {}),
    },
  })

  return NextResponse.json({
    success: true,
    dryRun,
    processed: items.length,
    updated,
    errors,
    lastId,
    done,
    remaining,
    changes: changes.slice(0, 40),
  })
}
