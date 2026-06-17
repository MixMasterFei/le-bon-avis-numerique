import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGameDetails, getPegiInfo } from "@/lib/igdb"
import { IGDB_ORG_PEGI, type IGDBAgeRatingEntry } from "@/lib/pegi-descriptors"

export const maxDuration = 60

/** True if any entry is PEGI (legacy category 2 or new organization id). */
function hasPegiEntry(ageRatings?: IGDBAgeRatingEntry[] | null): boolean {
  if (!ageRatings?.length) return false
  return ageRatings.some((r) => r.category === 2 || r.organization === IGDB_ORG_PEGI)
}

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
 * Diagnostics: the response splits "unchanged" into noAgeRatings / noPegi /
 * pegiUnchanged so a run that updates nothing tells us WHY (IGDB coverage gap
 * vs a parse mismatch). ?debug=1[&q=witcher] returns the RAW IGDB age_ratings
 * for a few games (no writes) so we can verify the rating shape directly.
 *
 * POST ?limit=30&afterId=<id>&dry=true
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const limit = Math.min(50, parseInt(sp.get("limit") || "30", 10) || 30)
  const dryRun = sp.get("dry") === "true"
  const afterId = sp.get("afterId") || undefined
  const debug = sp.get("debug") === "1"
  const debugQuery = sp.get("q") || undefined

  // ── Debug mode: dump raw IGDB age_ratings, no writes ──────────────────────
  // Lets us see exactly what IGDB returns (org ids, rating_category ids,
  // descriptor shape) so we can confirm/fix the PEGI mapping. Target a known
  // PEGI game with ?q=witcher, or omit q to sample the backlog.
  if (debug) {
    const sample = await prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        igdbId: { not: null },
        ...(debugQuery
          ? { title: { contains: debugQuery, mode: "insensitive" } }
          : { OR: [{ pegiDescriptors: { isEmpty: true } }, { officialRating: null }] }),
      },
      select: { id: true, title: true, igdbId: true, officialRating: true, pegiDescriptors: true },
      take: Math.min(limit, 8),
      orderBy: { id: "asc" },
    })

    const dump = []
    for (const item of sample) {
      try {
        const game = await getGameDetails(item.igdbId!)
        const pegi = getPegiInfo(game?.age_ratings)
        dump.push({
          title: item.title,
          igdbId: item.igdbId,
          storedOfficialRating: item.officialRating,
          storedDescriptors: item.pegiDescriptors,
          igdbFound: !!game,
          parsedPegi: pegi, // what getPegiInfo() extracts (null if mapping fails)
          rawAgeRatings: game?.age_ratings ?? null, // ground truth from IGDB
        })
      } catch (e) {
        dump.push({ title: item.title, igdbId: item.igdbId, error: e instanceof Error ? e.message : "error" })
      }
    }
    return NextResponse.json({ success: true, debug: true, query: debugQuery ?? null, dump })
  }

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
  // Diagnostic breakdown of the non-updates:
  let noAgeRatings = 0 // IGDB returned no age_ratings array at all
  let noPegi = 0 // had age_ratings but no PEGI entry (only ESRB/USK/none)
  let pegiUnchanged = 0 // PEGI found, already matches what we store
  const changes: string[] = []

  for (const item of items) {
    try {
      const game = await getGameDetails(item.igdbId!)
      if (!game) {
        errors++
        changes.push(`${item.title}: IGDB introuvable`)
        continue
      }

      const ageRatings = game.age_ratings
      if (!ageRatings?.length) {
        noAgeRatings++
        continue
      }
      if (!hasPegiEntry(ageRatings)) {
        noPegi++
        continue
      }

      const pegi = getPegiInfo(ageRatings)
      const descriptors = pegi?.descriptors ?? []
      const officialRating = pegi?.internal ?? item.officialRating

      if (
        descriptors.length === item.pegiDescriptors.length &&
        descriptors.every((d, i) => d === item.pegiDescriptors[i]) &&
        officialRating === item.officialRating
      ) {
        pegiUnchanged++
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
    // Why nothing changed (when updated === 0):
    noAgeRatings,
    noPegi,
    pegiUnchanged,
    lastId,
    done,
    remaining,
    changes: changes.slice(0, 40),
  })
}
