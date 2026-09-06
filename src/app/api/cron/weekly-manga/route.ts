import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import {
  getRecentlyUpdatedManga,
  pickDisplayTitle,
  extractDemographic,
  extractStatus,
  normalizeGenres,
  extractMainAuthors,
  toDate,
  type AniListManga,
} from "@/lib/anilist"
import { searchBooks } from "@/lib/google-books"
import { isAdultAniListManga } from "@/lib/adult-content-filter"

export const maxDuration = 60

/**
 * @deprecated RETIRED — manga pipeline decommissioned May 2026.
 *
 * This route is NO LONGER CALLED by any scheduled cron job. The ~12 manga
 * titles in the database are kept internally for historical reasons but are
 * NOT part of the public catalog. Do NOT add this route back to cron.yml or
 * call it from any automated pipeline.
 *
 * Kept in the codebase so existing rows aren't orphaned — a future admin
 * import-manga or manual trigger can still update metadata without breaking.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Original docstring (historical reference):
 *
 * Weekly manga refresh — runs Sundays 04:00 UTC via GitHub Actions.
 *
 * For each recently-updated AniList series:
 * - If we don't have it yet: create a new MediaItem with type=MANGA.
 * - If we have it: update volumeCount/chapterCount/status/latestVolumeDate.
 *
 * Side-effect: populates the "Nouveautés manga de la semaine" homepage
 * rail by keeping `latestVolumeDate` fresh.
 */

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Development bypass requires an explicit opt-in flag — see
  // weekly-dossier for the rationale (tunnel-exposed `next dev`).
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  ) {
    return true
  }
  return false
}

interface RefreshStats {
  fetched: number
  created: number
  updated: number
  errors: number
  errorDetails: string[]
  backfillMatched: number
  backfillSkipped: number
}

async function lookupFrenchEdition(displayTitle: string, authors: string[]): Promise<{
  publisher?: string
  publishedAt?: Date
  googleBookId?: string
}> {
  try {
    const authorHint = authors[0] ? ` inauthor:${authors[0]}` : ""
    const results = await searchBooks(`${displayTitle}${authorHint}`, {
      maxResults: 3,
      langRestrict: "fr",
    })
    const first = results.items?.[0]
    if (!first) return {}
    const publishedAt = first.volumeInfo.publishedDate
      ? new Date(first.volumeInfo.publishedDate)
      : undefined
    return {
      publisher: first.volumeInfo.publisher,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      googleBookId: first.id,
    }
  } catch {
    return {}
  }
}

async function upsertManga(m: AniListManga, stats: RefreshStats): Promise<void> {
  try {
    // Family-guide guard: never import hentai / ecchi / adult manga.
    if (
      isAdultAniListManga({
        isAdult: m.isAdult,
        genres: normalizeGenres(m),
        title: pickDisplayTitle(m),
        description: m.description,
      })
    ) {
      return
    }

    const existing = await prisma.mediaItem.findUnique({
      where: { anilistId: m.id },
      select: { id: true, latestVolumeDate: true, googleBookId: true },
    })

    const displayTitle = pickDisplayTitle(m)
    const authors = extractMainAuthors(m)

    if (existing) {
      // Update chapter/volume counts + status. Only re-run the
      // Google Books lookup when we don't yet have a googleBookId
      // (avoids burning API calls on every Sunday run).
      const edition = existing.googleBookId
        ? {}
        : await lookupFrenchEdition(displayTitle, authors)

      await prisma.mediaItem.update({
        where: { id: existing.id },
        data: {
          volumeCount: m.volumes ?? null,
          chapterCount: m.chapters ?? null,
          status: extractStatus(m),
          // Only bump latestVolumeDate if we found a newer date.
          latestVolumeDate:
            edition.publishedAt && (!existing.latestVolumeDate || edition.publishedAt > existing.latestVolumeDate)
              ? edition.publishedAt
              : undefined,
          googleBookId: edition.googleBookId ?? undefined,
        },
      })
      stats.updated += 1
    } else {
      const edition = await lookupFrenchEdition(displayTitle, authors)
      await prisma.mediaItem.create({
        data: {
          title: displayTitle,
          originalTitle: m.title.native ?? m.title.romaji ?? null,
          type: "MANGA",
          synopsisFr:
            m.description?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") || null,
          posterUrl: m.coverImage.extraLarge ?? m.coverImage.large ?? null,
          genres: normalizeGenres(m),
          anilistId: m.id,
          volumeCount: m.volumes ?? null,
          chapterCount: m.chapters ?? null,
          demographic: extractDemographic(m),
          status: extractStatus(m),
          dataSource: "ANILIST",
          releaseDate: edition.publishedAt ?? toDate(m.startDate) ?? null,
          latestVolumeDate: edition.publishedAt ?? null,
          googleBookId: edition.googleBookId ?? null,
          director: authors.join(", ") || null,
          originalLanguage: "ja",
        },
      })
      stats.created += 1
    }
  } catch (e) {
    stats.errors += 1
    const msg = e instanceof Error ? e.message : String(e)
    stats.errorDetails.push(`${m.id} (${m.title.english ?? m.title.romaji}): ${msg}`)
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runId = randomUUID()
  const startedAt = Date.now()
  const url = new URL(req.url)
  const dry = url.searchParams.get("dry") === "true"
  const pages = Math.min(Math.max(parseInt(url.searchParams.get("pages") ?? "2"), 1), 4)

  const stats: RefreshStats = {
    fetched: 0,
    created: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    backfillMatched: 0,
    backfillSkipped: 0,
  }

  try {
    // Phase 1: AniList refresh.
    // Pull 2 pages × 50 = up to 100 recently-updated manga series.
    // AniList sorts by UPDATED_AT_DESC so these are the most active titles.
    for (let page = 1; page <= pages; page++) {
      const mangas = await getRecentlyUpdatedManga({ perPage: 50, page })
      stats.fetched += mangas.length

      if (dry) continue

      for (const m of mangas) {
        await upsertManga(m, stats)
      }
    }

    // Phase 2: French-edition backfill for older rows that predate
    // the Google Books lookup or whose first lookup failed. Capped so
    // the whole cron stays under the 60s Vercel serverless limit.
    if (!dry) {
      const backfillCap = 15
      const pending = await prisma.mediaItem.findMany({
        where: { type: "MANGA", googleBookId: null },
        orderBy: { createdAt: "asc" },
        take: backfillCap,
        select: { id: true, title: true, director: true, latestVolumeDate: true },
      })

      for (const item of pending) {
        try {
          const authors = item.director ? [item.director.split(",")[0].trim()] : []
          const edition = await lookupFrenchEdition(item.title, authors)
          if (edition.googleBookId) {
            await prisma.mediaItem.update({
              where: { id: item.id },
              data: {
                googleBookId: edition.googleBookId,
                latestVolumeDate:
                  edition.publishedAt &&
                  (!item.latestVolumeDate || edition.publishedAt > item.latestVolumeDate)
                    ? edition.publishedAt
                    : undefined,
              },
            })
            stats.backfillMatched += 1
          } else {
            stats.backfillSkipped += 1
          }
        } catch (e) {
          stats.errors += 1
          const msg = e instanceof Error ? e.message : String(e)
          stats.errorDetails.push(`backfill ${item.id}: ${msg}`)
        }
      }
    }

    const durationMs = Date.now() - startedAt
    await logCronRun({
      task: "weekly-manga",
      status: stats.errors > 0 ? "partial" : "success",
      summary: `fetched=${stats.fetched} created=${stats.created} updated=${stats.updated} backfillFR=${stats.backfillMatched}/${stats.backfillMatched + stats.backfillSkipped} errors=${stats.errors}`,
      details: { runId, dry, pages, stats },
      startTime: startedAt,
    })

    return NextResponse.json({ success: true, dry, ...stats, durationMs })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logCronRun({
      task: "weekly-manga",
      status: "error",
      summary: `Weekly manga refresh failed: ${msg}`,
      details: { runId, stats, error: msg },
      startTime: startedAt,
    })
    return NextResponse.json({ success: false, error: msg, ...stats }, { status: 500 })
  }
}
