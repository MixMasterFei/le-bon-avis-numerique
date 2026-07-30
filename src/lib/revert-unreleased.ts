/**
 * Revert titles that were enriched while still UNRELEASED back to
 * "provisional", so their fabricated content metrics stop showing.
 *
 * Shared core used by both the CLI script (scripts/revert-unreleased-to-
 * provisional.ts) and the admin route (/api/admin/revert-unreleased).
 *
 *   - deletes the ContentMetrics row (guessed 0–5 dimensions)
 *   - sets isEnriched = false → re-enters the enrichment queue, which now
 *     skips it until it's actually released (enrich/route.ts guard)
 *   - writes releaseStatus from TMDB so the guard keeps blocking it even when
 *     the release date is unknown (the null-date case)
 *   - KEEPS expertAgeRec → stays visible with a provisional "à confirmer" age
 *
 * Two passes:
 *   A. future-dated + enriched  → revert (no API needed)
 *   B. NULL-dated + enriched (movies/TV) → cross-check TMDB lifecycle; revert
 *      only those whose status is pre-release (the "Indestructibles 3" case).
 * Pass B needs TMDB_API_KEY.
 */
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { getGameReleaseStatus, isUnreleasedGameStatus } from "@/lib/igdb"
import { isUnreleasedStatus } from "@/lib/release-status"

export interface RevertTarget {
  id: string
  title: string
  type: string
  reason: string
  releaseStatus: string | null
  hadMetrics: boolean
}

export interface RevertResult {
  dryRun: boolean
  checkedNullDated: number
  targets: RevertTarget[]
  reverted: number
}

export interface RevertOptions {
  apply?: boolean
  /** Skip the TMDB-status pass over null-dated titles (Pass B). */
  skipNull?: boolean
  /** Cap how many null-dated candidates Pass B inspects. 0 = no cap. */
  limit?: number
  onProgress?: (message: string) => void
}

export async function revertUnreleasedToProvisional(
  opts: RevertOptions = {}
): Promise<RevertResult> {
  const { apply = false, skipNull = false, limit = 0, onProgress } = opts
  const now = new Date()
  const targets: RevertTarget[] = []
  let checkedNullDated = 0

  // ── Pass A: future-dated + enriched ───────────────────────────────
  const futureDated = await prisma.mediaItem.findMany({
    where: { isEnriched: true, releaseDate: { gt: now } },
    select: { id: true, title: true, type: true, releaseDate: true, contentMetrics: { select: { id: true } } },
    orderBy: { releaseDate: "asc" },
  })
  for (const m of futureDated) {
    targets.push({
      id: m.id,
      title: m.title,
      type: m.type,
      reason: `date ${m.releaseDate?.toISOString().split("T")[0]}`,
      releaseStatus: null,
      hadMetrics: !!m.contentMetrics,
    })
  }

  // ── Pass B: null-dated + enriched (movies/TV) via TMDB status ──────
  if (!skipNull) {
    let candidates = await prisma.mediaItem.findMany({
      where: { isEnriched: true, releaseDate: null, tmdbId: { not: null }, type: { in: ["MOVIE", "TV"] } },
      select: { id: true, title: true, type: true, tmdbId: true, contentMetrics: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    })
    if (limit > 0) candidates = candidates.slice(0, limit)
    checkedNullDated = candidates.length
    onProgress?.(`Pass B: checking TMDB status for ${candidates.length} null-dated enriched movies/TV…`)

    for (const m of candidates) {
      try {
        const details =
          m.type === "MOVIE" ? await getMovieDetails(m.tmdbId!) : await getTVDetails(m.tmdbId!)
        const status = (details as { status?: string }).status || null
        if (isUnreleasedStatus(status)) {
          targets.push({
            id: m.id,
            title: m.title,
            type: m.type,
            reason: `status "${status}"`,
            releaseStatus: status,
            hadMetrics: !!m.contentMetrics,
          })
        }
        await new Promise((r) => setTimeout(r, 120)) // be gentle on TMDB
      } catch (e) {
        onProgress?.(`  ! TMDB lookup failed for ${m.title}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ── Pass C: null-dated + enriched GAMES via IGDB lifecycle ─────────
  // Games carry no releaseStatus at all (IGDB imports never mapped one), so
  // Passes A and B leave them with no lifecycle signal whatsoever.
  //
  // In practice this pass finds nothing, by design: every game DISCOVERY query
  // filters on `total_rating_count > N`, and a rating count only accumulates
  // once people have played the game — so an unreleased title cannot surface
  // there. Two paths skip that filter (import by explicit id, and the
  // developer-catalogue listing), and this pass exists for those.
  if (!skipNull) {
    let games = await prisma.mediaItem.findMany({
      where: { isEnriched: true, releaseDate: null, igdbId: { not: null }, type: "GAME" },
      select: { id: true, title: true, type: true, igdbId: true, contentMetrics: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    })
    if (limit > 0) games = games.slice(0, limit)
    checkedNullDated += games.length
    onProgress?.(`Pass C: checking IGDB status for ${games.length} null-dated enriched games…`)

    for (const g of games) {
      try {
        const status = await getGameReleaseStatus(g.igdbId!)
        if (isUnreleasedGameStatus(status)) {
          targets.push({
            id: g.id,
            title: g.title,
            type: g.type,
            reason: `igdb status "${status}"`,
            releaseStatus: status,
            hadMetrics: !!g.contentMetrics,
          })
        }
        await new Promise((r) => setTimeout(r, 120)) // be gentle on IGDB
      } catch (e) {
        onProgress?.(`  ! IGDB lookup failed for ${g.title}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  if (!apply) {
    return { dryRun: true, checkedNullDated, targets, reverted: 0 }
  }

  let reverted = 0
  for (const t of targets) {
    if (t.hadMetrics) {
      await prisma.contentMetrics.delete({ where: { mediaId: t.id } }).catch(() => {})
    }
    await prisma.mediaItem.update({
      where: { id: t.id },
      data: { isEnriched: false, ...(t.releaseStatus ? { releaseStatus: t.releaseStatus } : {}) },
    })
    reverted++
  }

  return { dryRun: false, checkedNullDated, targets, reverted }
}
