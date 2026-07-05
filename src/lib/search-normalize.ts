import { prisma } from "@/lib/prisma"

/**
 * Escape Postgres LIKE wildcards (`%`, `_`) and the escape char itself so
 * raw user input can't act as a pattern. Pair with `ESCAPE '\'` in the query.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => "\\" + c)
}

/**
 * Diacritic- and case-insensitive title match against the media catalog.
 *
 * Returns the ids of MediaItems whose title / originalTitle contain `query`,
 * ignoring accents (via the Postgres `unaccent` extension) so "amelie
 * poulain" finds "Le Fabuleux Destin d'Amélie Poulain". Ordered by popularity
 * and capped, so the returned set is safe to feed into an `id IN (...)` filter
 * that then applies the caller's own gates / sort / pagination.
 *
 * Returns [] on any error — callers treat that as "no matches".
 */
export async function matchMediaIdsByTitle(
  query: string,
  opts: { limit?: number } = {},
): Promise<string[]> {
  const q = query.trim()
  if (q.length < 1) return []
  const limit = opts.limit ?? 200
  const pattern = "%" + escapeLike(q) + "%"
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM media_items
      WHERE unaccent(lower(title)) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
         OR unaccent(lower(coalesce(original_title, ''))) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
      ORDER BY tmdb_vote_count DESC NULLS LAST
      LIMIT ${limit}
    `
    return rows.map((r) => r.id)
  } catch (error) {
    console.error("[matchMediaIdsByTitle] failed:", error)
    return []
  }
}

/**
 * Thematic / subject match ("histoire", "amitié", "espace", "seconde guerre
 * mondiale") against genres, topic tags AND synopsis — accent-insensitive —
 * ranked by thematic relevance rather than raw popularity.
 *
 * This is the fix for subject queries like "un film sur l'histoire pour
 * enfants": ranking by tmdbVoteCount alone surfaced blockbusters (Avengers,
 * Iron Man) before the one genuinely on-topic title. A genre/topic hit is
 * worth more than a synopsis mention; popularity is only the tie-breaker.
 *
 * Returns ordered ids (most relevant first), capped. [] on error.
 */
export async function matchMediaIdsByTheme(
  theme: string,
  opts: { limit?: number } = {},
): Promise<string[]> {
  const t = theme.trim()
  if (t.length < 2) return []
  const limit = opts.limit ?? 40
  const pattern = "%" + escapeLike(t) + "%"
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM media_items
      WHERE type <> 'MANGA'
        AND (
          EXISTS (SELECT 1 FROM unnest(genres) g WHERE unaccent(lower(g)) LIKE unaccent(lower(${pattern})) ESCAPE '\\')
          OR EXISTS (SELECT 1 FROM unnest(topics) tp WHERE unaccent(lower(tp)) LIKE unaccent(lower(${pattern})) ESCAPE '\\')
          OR unaccent(lower(coalesce(synopsis_fr, ''))) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
          OR unaccent(lower(title)) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
        )
      ORDER BY
        ( (EXISTS (SELECT 1 FROM unnest(genres) g WHERE unaccent(lower(g)) LIKE unaccent(lower(${pattern})) ESCAPE '\\'))::int * 3
        + (EXISTS (SELECT 1 FROM unnest(topics) tp WHERE unaccent(lower(tp)) LIKE unaccent(lower(${pattern})) ESCAPE '\\'))::int * 3
        + (unaccent(lower(coalesce(synopsis_fr, ''))) LIKE unaccent(lower(${pattern})) ESCAPE '\\')::int
        + (unaccent(lower(title)) LIKE unaccent(lower(${pattern})) ESCAPE '\\')::int
        ) DESC,
        tmdb_vote_count DESC NULLS LAST
      LIMIT ${limit}
    `
    return rows.map((r) => r.id)
  } catch (error) {
    console.error("[matchMediaIdsByTheme] failed:", error)
    return []
  }
}
