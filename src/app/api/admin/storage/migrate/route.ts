import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  uploadPoster,
  uploadBackdrop,
  uploadScreenshot,
  isSupabaseUrl,
  isStorageEnabled,
} from "@/lib/supabase-storage"

export const maxDuration = 60

/**
 * Migrate external image URLs (TMDB/IGDB) to Supabase Storage.
 * Chunked endpoint — called repeatedly by the Operations Center.
 *
 * POST body:
 *   target: "posters" | "backdrops" | "screenshots" | "all"
 *   limit: number (items per chunk, default 10)
 *
 * Query params:
 *   afterId: cursor for pagination
 */
export async function POST(request: NextRequest) {
  if (!isStorageEnabled()) {
    return NextResponse.json(
      { error: "Supabase Storage not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 400 },
    )
  }

  try {
    const body = await request.json()
    const { target = "all", limit = 10 } = body
    const afterId = request.nextUrl.searchParams.get("afterId")

    const migratePosters = target === "posters" || target === "all"
    const migrateBackdrops = target === "backdrops" || target === "all"
    const migrateScreenshots = target === "screenshots" || target === "all"

    const stats = { total: 0, imported: 0, skipped: 0, errors: 0, details: [] as string[] }
    let lastId: string | null = null

    // ── Migrate posters and backdrops (MediaItem) ────────────
    if (migratePosters || migrateBackdrops) {
      const items = await prisma.mediaItem.findMany({
        where: {
          AND: [
            // Has a poster URL that is NOT already on Supabase
            {
              posterUrl: { not: null },
            },
            ...(afterId ? [{ id: { gt: afterId } }] : []),
          ],
        },
        select: {
          id: true,
          title: true,
          posterUrl: true,
          backdropUrl: true,
        },
        take: limit,
        orderBy: { id: "asc" },
      })

      // Count remaining for progress
      const remaining = await prisma.mediaItem.count({
        where: {
          posterUrl: { not: null },
          ...(items.length > 0 ? { id: { gt: items[items.length - 1].id } } : {}),
        },
      })

      for (const item of items) {
        stats.total++
        lastId = item.id

        // Skip if already migrated
        const posterAlreadyMigrated = isSupabaseUrl(item.posterUrl)
        const backdropAlreadyMigrated = isSupabaseUrl(item.backdropUrl)

        if (posterAlreadyMigrated && (backdropAlreadyMigrated || !item.backdropUrl)) {
          stats.skipped++
          continue
        }

        try {
          let newPosterUrl: string | null = null
          let newBackdropUrl: string | null = null

          // Upload poster and backdrop in parallel
          const uploads = await Promise.allSettled([
            migratePosters && item.posterUrl && !posterAlreadyMigrated
              ? uploadPoster(item.id, item.posterUrl)
              : Promise.resolve(null),
            migrateBackdrops && item.backdropUrl && !backdropAlreadyMigrated
              ? uploadBackdrop(item.id, item.backdropUrl)
              : Promise.resolve(null),
          ])

          if (uploads[0].status === "fulfilled" && uploads[0].value) {
            newPosterUrl = uploads[0].value
          }
          if (uploads[1].status === "fulfilled" && uploads[1].value) {
            newBackdropUrl = uploads[1].value
          }

          if (newPosterUrl || newBackdropUrl) {
            await prisma.mediaItem.update({
              where: { id: item.id },
              data: {
                ...(newPosterUrl ? { posterUrl: newPosterUrl } : {}),
                ...(newBackdropUrl ? { backdropUrl: newBackdropUrl } : {}),
                lastVerifiedAt: new Date(),
              },
            })
            stats.imported++
            stats.details.push(`${item.title}`)
          } else {
            stats.skipped++
          }
        } catch (err) {
          stats.errors++
          console.error(`[migrate] Error migrating ${item.title}:`, err)
        }

        // Small delay to avoid overwhelming the source
        await new Promise((r) => setTimeout(r, 200))
      }

      const done = items.length < limit

      if (!migrateScreenshots || done) {
        return NextResponse.json({
          success: true,
          done,
          lastId,
          remaining: done ? 0 : remaining,
          stats,
        })
      }
    }

    // ── Migrate screenshots (MediaScreenshot) ────────────────
    if (migrateScreenshots) {
      const screenshots = await prisma.mediaScreenshot.findMany({
        where: {
          url: { not: { contains: "supabase.co/storage/" } },
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        select: {
          id: true,
          url: true,
          media: { select: { title: true } },
        },
        take: limit,
        orderBy: { id: "asc" },
      })

      const remaining = await prisma.mediaScreenshot.count({
        where: {
          url: { not: { contains: "supabase.co/storage/" } },
          ...(screenshots.length > 0 ? { id: { gt: screenshots[screenshots.length - 1].id } } : {}),
        },
      })

      for (const ss of screenshots) {
        stats.total++
        lastId = ss.id

        try {
          const newUrl = await uploadScreenshot(ss.id, ss.url)
          if (newUrl) {
            await prisma.mediaScreenshot.update({
              where: { id: ss.id },
              data: { url: newUrl },
            })
            stats.imported++
            stats.details.push(`Screenshot: ${ss.media.title}`)
          } else {
            stats.skipped++
          }
        } catch (err) {
          stats.errors++
          console.error(`[migrate] Error migrating screenshot ${ss.id}:`, err)
        }

        await new Promise((r) => setTimeout(r, 200))
      }

      return NextResponse.json({
        success: true,
        done: screenshots.length < limit,
        lastId,
        remaining: screenshots.length < limit ? 0 : remaining,
        stats,
      })
    }

    return NextResponse.json({ success: true, done: true, stats })
  } catch (error) {
    console.error("[migrate] Storage migration error:", error)
    return NextResponse.json(
      { error: "Storage migration failed", details: String(error) },
      { status: 500 },
    )
  }
}
