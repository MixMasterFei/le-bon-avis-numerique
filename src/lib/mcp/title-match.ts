// Title-resolution heuristic for the MCP get_age_verdict tool.
//
// Ranking by dataQualityScore alone picks the WRONG film for title
// collisions: asked for "L'Odyssée" in July 2026, it returned the enriched
// 2016 Cousteau biopic instead of the provisional fiche of the 2026 release
// parents are actually asking about (our single most-searched title). Rule:
// among EXACT title matches (accent/case/punctuation-insensitive), prefer the
// most recent release — when a parent names a title exactly, they mean the
// culturally current one; the alternates list still surfaces the others.
// Without an exact match, keep the quality ordering (fragment queries like
// "Narnia" should still land on the best fiche).

export interface TitleMatchRow {
  title: string
  releaseDate: Date | null
}

export function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Rows must arrive quality-ordered (searchCatalog order). Returns the row to answer with. */
export function pickBestTitleMatch<T extends TitleMatchRow>(rows: T[], query: string): T | undefined {
  if (rows.length === 0) return undefined
  const q = normalizeTitle(query)
  const exact = rows.filter((r) => normalizeTitle(r.title) === q)
  if (exact.length === 0) return rows[0]
  return exact
    .slice()
    .sort((a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0))[0]
}
