/**
 * Gate for the V3 "scoreboard dashboard" media fiche (rendered at `/media/[id]`
 * for movies/games/TV; also the `/media/[id]/apercu` admin preview).
 *
 * PUBLIC by default since 2026-07-06 — the dashboard is the live fiche for
 * everyone. Kill-switch: set `MEDIA_V3_PUBLIC="false"` in Vercel to fall the
 * public back to the classic fiche (admins still get the dashboard). Mirrors
 * the inverse of the earlier admin-only gate.
 *
 * Pure + synchronous so server pages can call it after resolving `isAdmin`.
 */
export function isMediaV3Public(): boolean {
  return process.env.MEDIA_V3_PUBLIC !== "false"
}

/** True when the viewer should be allowed the dashboard — public flag on, or admin. */
export function mediaV3Enabled(isAdmin: boolean): boolean {
  return isMediaV3Public() || isAdmin
}
