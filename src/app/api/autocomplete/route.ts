import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sanitizeSearchQuery } from "@/lib/security"
import { PUBLIC_MEDIA_QUALITY_FLOOR } from "@/lib/media-route"
import { compactTitle, compactSql, relevanceOrderSql } from "@/lib/search-normalize"

// Optional ?type= filter — restricts results to a single MediaType.
// Anything else (or absent) returns all eligible types.
const ALLOWED_TYPES = new Set(["MOVIE", "TV", "GAME", "BOOK"])

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const rawQuery = sp.get("q")
  const typeFilter = sp.get("type")?.toUpperCase()
  const scopedType = typeFilter && ALLOWED_TYPES.has(typeFilter) ? typeFilter : null

  if (!rawQuery || rawQuery.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const query = sanitizeSearchQuery(rawQuery)
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    // Accent- and case-insensitive title match via the Postgres `unaccent`
    // extension, so "amelie" suggests "Amélie" and "wall-e" still matches
    // "WALL·E" (the % wildcards survive unaccent; accents don't). Ordered by
    // popularity so the best-known title surfaces first.
    // `scopedType` is validated against a closed allowlist above, so
    // interpolating it into the type clause is safe.
    // Compacted match: punctuation is removed on BOTH sides, so "spiderman"
    // finds "Spider-Man" and "sos fantomes" finds "S.O.S. Fantômes" — neither
    // of which matched before. Leading articles are dropped too, so "odyssée"
    // is an EXACT hit on "L'Odyssée" rather than a mid-string substring that
    // ranked below "2001 : L'Odyssée de l'espace".
    const compact = compactTitle(query)
    if (!compact) return NextResponse.json({ suggestions: [] })

    const typeClause = scopedType
      ? `type = '${scopedType}'`
      : `type != 'MANGA'`
    const ct = compactSql("title")
    const co = compactSql("coalesce(original_title, '')")

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string
      title: string
      type: string
      poster_url: string | null
      release_date: Date | null
      expert_age_rec: number | null
    }>>(
      `SELECT id, title, type, poster_url, release_date, expert_age_rec
       FROM media_items
       WHERE ${typeClause}
         AND poster_url IS NOT NULL
         AND data_quality_score >= ${PUBLIC_MEDIA_QUALITY_FLOOR}
         AND (${ct} LIKE '%' || $1 || '%' OR ${co} LIKE '%' || $1 || '%')
       ORDER BY ${relevanceOrderSql(ct, co, "$1")}
       LIMIT 8`,
      compact,
    )

    const suggestions = rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      posterUrl: row.poster_url,
      year: row.release_date ? new Date(row.release_date).getFullYear() : null,
      ageRec: row.expert_age_rec,
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Autocomplete error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
