type CuratedGameSeed = {
  aliases: readonly string[]
  catalogueTitles?: readonly string[]
  /** YYYY-MM-DD — see TopGameSeed.releasedFrom. Only settles a same-title tie. */
  releasedFrom?: string
}

/** Full, editorially selected titles in preference order, never title fragments. */
export function catalogueTitlesForSeed(seed: CuratedGameSeed): readonly string[] {
  return seed.catalogueTitles ?? seed.aliases
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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
 * identifies the intended record instead of guessing from its quality score —
 * unless the seed has a `releasedFrom` window and exactly one of them was
 * released inside it (the 2016 Overwatch and its successor sold under the
 * same name; the 1998 Ocarina of Time and its Switch 2 remake). Outside a
 * tie the window is ignored: a seed keeps its card on the older row until
 * the newer one exists.
 */
export function matchCuratedGame<T extends { id: string; title: string; releaseDate?: Date | null }>(
  seed: CuratedGameSeed,
  candidates: readonly T[],
): T | undefined {
  const from = seed.releasedFrom ? Date.parse(`${seed.releasedFrom}T00:00:00.000Z`) : NaN
  for (const title of catalogueTitlesForSeed(seed)) {
    const normalized = normalizeTitle(title)
    if (!normalized) continue
    const matches = new Map(
      candidates
        .filter((candidate) => normalizeTitle(candidate.title) === normalized)
        .map((candidate) => [candidate.id, candidate]),
    )
    if (matches.size > 1) {
      if (Number.isNaN(from)) return undefined
      const inWindow = [...matches.values()].filter(
        (candidate) => candidate.releaseDate != null && candidate.releaseDate.getTime() >= from,
      )
      return inWindow.length === 1 ? inWindow[0] : undefined
    }
    if (matches.size === 1) return matches.values().next().value
  }
  return undefined
}
