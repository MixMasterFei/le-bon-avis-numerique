import { prisma } from "@/lib/prisma"

/**
 * Escape Postgres LIKE wildcards (`%`, `_`) and the escape char itself so
 * raw user input can't act as a pattern. Pair with `ESCAPE '\'` in the query.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => "\\" + c)
}

/**
 * Leading articles stripped before comparing a title, so a user who types the
 * work's name without its article still gets an EXACT match. "odyssée" has to
 * find "L'Odyssée" — the article is not part of how anyone refers to a film.
 */
const LEADING_ARTICLES = "l|le|la|les|the|a|an|un|une"

/**
 * Compact form of a title/query: accent-free, article-free, and stripped of
 * EVERY non-alphanumeric character (not merely collapsed to spaces).
 *
 * Removing punctuation outright rather than replacing it with a space is what
 * makes "spiderman" match "Spider-Man", "sos fantomes" match "S.O.S. Fantômes"
 * and "wall e" match "WALL·E". A space-collapsing normaliser leaves
 * "spider man", which a "%spiderman%" pattern still misses — verified against
 * the live catalogue, where "spiderman" matched 0 rows and "spider-man" 18.
 *
 * Keep this in exact sync with `compactSql` below: the TS version is used for
 * ranking/tests, the SQL version runs inside the query.
 */
export function compactTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(new RegExp(`^(?:${LEADING_ARTICLES})['’\\s]+`), "")
    .replace(/[^a-z0-9]+/g, "")
}

/**
 * SQL mirror of `compactTitle` for a given column/expression. Inlined into the
 * query because the catalogue has no functional index for it; at ~12k rows the
 * sequential scan is acceptable. If search latency ever matters, the fix is an
 * index on this exact expression (it must be marked IMMUTABLE first).
 */
export function compactSql(expr: string): string {
  return `regexp_replace(
            regexp_replace(unaccent(lower(${expr})),
              '^(?:${LEADING_ARTICLES})[''’[:space:]]+', ''),
            '[^a-z0-9]+', '', 'g')`
}

/**
 * Relevance ordering shared by every title search.
 *
 * Ranking used to be `tmdb_vote_count DESC` alone, which is not relevance at
 * all — it buries any title the crowd hasn't rated yet. Measured on the live
 * catalogue: "L'Odyssée" (2026) came 6th of 6 behind 2001, Narnia and a 2016
 * documentary of the same name, and "Spider-Man: Brand New Day" did not make
 * the top 12 at all, i.e. was unreachable under the autocomplete's LIMIT 8 —
 * both while in cinemas and driving the site's top two pages.
 *
 * Tiers: exact title, then prefix, then anywhere. Inside a tier, a title in
 * cinemas now (or upcoming) outranks the back catalogue, and popularity is
 * only the final tie-break.
 */
export function relevanceOrderSql(titleExpr: string, origExpr: string, param: string): string {
  return `CASE WHEN ${titleExpr} = ${param} OR ${origExpr} = ${param} THEN 0
               WHEN ${titleExpr} LIKE ${param} || '%' OR ${origExpr} LIKE ${param} || '%' THEN 1
               ELSE 2 END,
          CASE WHEN release_date >= now() - interval '90 days' THEN 0 ELSE 1 END,
          tmdb_vote_count DESC NULLS LAST`
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
  const compact = compactTitle(q)
  // Compacting already removed `%` and `_` (they are non-alphanumeric), so the
  // value cannot act as a LIKE pattern and needs no escaping.
  if (!compact) return []

  const ct = compactSql("title")
  const co = compactSql("coalesce(original_title, '')")

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id
       FROM media_items
       WHERE ${ct} LIKE '%' || $1 || '%'
          OR ${co} LIKE '%' || $1 || '%'
       ORDER BY ${relevanceOrderSql(ct, co, "$1")}
       LIMIT ${Number(limit)}`,
      compact,
    )
    return rows.map((r) => r.id)
  } catch (error) {
    // A thrown query used to return [], which the caller turns into
    // `id IN ()` — indistinguishable from "this title isn't in the catalogue".
    // A silent empty result set is the worst possible failure for a search box,
    // so fall back to a plain accent-insensitive LIKE before giving up.
    console.error("[matchMediaIdsByTitle] relevance query failed, falling back:", error)
    try {
      const pattern = "%" + escapeLike(q) + "%"
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM media_items
        WHERE lower(title) LIKE lower(${pattern}) ESCAPE '\\'
           OR lower(coalesce(original_title, '')) LIKE lower(${pattern}) ESCAPE '\\'
        ORDER BY tmdb_vote_count DESC NULLS LAST
        LIMIT ${limit}
      `
      return rows.map((r) => r.id)
    } catch (fallbackError) {
      console.error("[matchMediaIdsByTitle] fallback failed:", fallbackError)
      return []
    }
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
