type CuratedGameSeed = {
  aliases: readonly string[]
  catalogueTitles?: readonly string[]
}

/** Full, editorially selected titles in preference order, never title fragments. */
export function catalogueTitlesForSeed(seed: CuratedGameSeed): readonly string[] {
  return seed.catalogueTitles ?? seed.aliases
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Identity comes before enrichment quality. A title fragment such as "among
 * us" must never select "The Wolf Among Us", nor an unlisted sequel/edition.
 * Explicit franchise titles are tried in editorial order. Duplicate records
 * for the same normalized title are ambiguous: omit the row until a forced ID
 * identifies the intended record instead of guessing from its quality score.
 */
export function matchCuratedGame<T extends { id: string; title: string }>(
  seed: CuratedGameSeed,
  candidates: readonly T[],
): T | undefined {
  for (const title of catalogueTitlesForSeed(seed)) {
    const normalized = normalizeTitle(title)
    if (!normalized) continue
    const matches = new Map(
      candidates
        .filter((candidate) => normalizeTitle(candidate.title) === normalized)
        .map((candidate) => [candidate.id, candidate]),
    )
    if (matches.size > 1) return undefined
    if (matches.size === 1) return matches.values().next().value
  }
  return undefined
}
