/**
 * Fiches that were merged into another one.
 *
 * When a duplicate fiche is deleted (same game imported twice under two
 * IGDB ids, say), its URL may already be indexed or linked. Rather than
 * 404, the middleware answers a permanent redirect to the survivor. Key:
 * the deleted media id. Value: the survivor's route id (`<type>:<id>`),
 * see toMediaRouteId in media-route.ts.
 *
 * Add a line here whenever a fiche is folded into another by hand or by
 * /api/admin/dedupe.
 */
export const MERGED_MEDIA_IDS: Readonly<Record<string, string>> = {
  // Grand Theft Auto V — the 2015 re-release entry (IGDB 239064) folded
  // into the original (IGDB 1020) on 2026-09-12.
  "068c5396-4416-4f33-9bd7-3ac5e826c0d9": "game:ced84a43-f4b1-4d7a-ae0c-489aee0a11e1",
}

const MEDIA_PATH = /^\/media\/(?:[a-z]+(?::|%3a))?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

/**
 * `/media/<id>` or `/media/<type>:<id>` of a merged fiche → the survivor's
 * path, null for every other pathname.
 */
export function resolveMergedMediaPath(pathname: string): string | null {
  const match = pathname.match(MEDIA_PATH)
  if (!match) return null
  const target = MERGED_MEDIA_IDS[match[1].toLowerCase()]
  return target ? `/media/${target}` : null
}
