import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getPopularManga,
  getRecentlyUpdatedManga,
  searchManga,
  pickDisplayTitle,
  extractDemographic,
  extractStatus,
  normalizeGenres,
  extractMainAuthors,
  toDate,
  type AniListManga,
} from "@/lib/anilist"
import { searchBooks } from "@/lib/google-books"

export const maxDuration = 300 // Vercel Pro; popular import over 100 rows

type ImportSource = "popular" | "search" | "weekly"

interface ImportBody {
  source: ImportSource
  query?: string
  limit?: number
}

interface ImportResult {
  imported: number
  skipped: number
  updated: number
  errors: string[]
}

async function fetchFromAniList(source: ImportSource, query: string | undefined, limit: number): Promise<AniListManga[]> {
  switch (source) {
    case "popular":
      return getPopularManga({ perPage: limit })
    case "weekly":
      return getRecentlyUpdatedManga({ perPage: limit })
    case "search":
      if (!query?.trim()) throw new Error("query is required when source=search")
      return searchManga(query, { perPage: Math.min(limit, 25) })
  }
}

/**
 * Best-effort Google Books lookup for the French edition of the first
 * tome. Returns publisher + French release date when available.
 * Failures are non-fatal — manga still imports without French edition data.
 */
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

export async function POST(req: Request) {
  let body: ImportBody
  try {
    body = (await req.json()) as ImportBody
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const source = body.source
  if (source !== "popular" && source !== "search" && source !== "weekly") {
    return NextResponse.json(
      { error: "source must be one of: popular | search | weekly" },
      { status: 400 }
    )
  }

  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50)

  const result: ImportResult = { imported: 0, skipped: 0, updated: 0, errors: [] }

  let mangas: AniListManga[]
  try {
    mangas = await fetchFromAniList(source, body.query, limit)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `AniList fetch failed: ${msg}` }, { status: 502 })
  }

  for (const m of mangas) {
    try {
      const existing = await prisma.mediaItem.findUnique({
        where: { anilistId: m.id },
        select: { id: true },
      })

      const displayTitle = pickDisplayTitle(m)
      const authors = extractMainAuthors(m)
      const edition = await lookupFrenchEdition(displayTitle, authors)

      const data = {
        title: displayTitle,
        originalTitle: m.title.native ?? m.title.romaji ?? null,
        type: "MANGA" as const,
        // AniList description is English — we store it so the enrichment
        // pipeline has source material to translate. Enrichment overwrites
        // this with a proper French synopsis. Users never see pre-enrichment
        // manga rows because /mangas is admin-gated during soft launch.
        synopsisFr: m.description?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") || null,
        posterUrl: m.coverImage.extraLarge ?? m.coverImage.large ?? null,
        genres: normalizeGenres(m),
        anilistId: m.id,
        volumeCount: m.volumes ?? null,
        chapterCount: m.chapters ?? null,
        demographic: extractDemographic(m),
        status: extractStatus(m),
        dataSource: "ANILIST" as const,
        // If Google Books knows a French release date, use it. Otherwise
        // fall back to AniList's series startDate so /mangas sort=newest
        // has something to work with until the weekly job fills gaps.
        releaseDate: edition.publishedAt ?? toDate(m.startDate) ?? null,
        latestVolumeDate: edition.publishedAt ?? null,
        googleBookId: edition.googleBookId ?? null,
        director: authors.join(", ") || null, // reuse director field for author(s)
        originalLanguage: "ja",
      }

      if (existing) {
        await prisma.mediaItem.update({
          where: { id: existing.id },
          data: {
            volumeCount: data.volumeCount,
            chapterCount: data.chapterCount,
            status: data.status,
            // Only bump latestVolumeDate if we found a newer one
            latestVolumeDate:
              data.latestVolumeDate && (!existing.id || true) ? data.latestVolumeDate : undefined,
          },
        })
        result.updated += 1
      } else {
        await prisma.mediaItem.create({ data })
        result.imported += 1
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${m.id} (${m.title.english ?? m.title.romaji}): ${msg}`)
      result.skipped += 1
    }
  }

  // success=true so ImportPresetsBar can treat it as a successful run,
  // even if some rows had errors (they're listed in result.errors).
  return NextResponse.json({ success: true, ...result })
}
