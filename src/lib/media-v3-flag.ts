/**
 * Gate for the V3 "scoreboard dashboard" redesign of the media detail page
 * (`/media/[id]/apercu`).
 *
 * Admin-only until `MEDIA_V3_PUBLIC=true` flips it on for everyone — a single
 * env switch with instant rollback, mirroring `HOMEPAGE_V2_PUBLIC` /
 * `TOTEM_PUBLIC`. Default OFF: the public keeps the current ISR fiche
 * (untouched, SEO-safe) until we deliberately promote the dashboard.
 *
 * Pure + synchronous so server pages can call it after resolving `isAdmin`.
 */
export function isMediaV3Public(): boolean {
  return process.env.MEDIA_V3_PUBLIC === "true"
}

/** True when the viewer should be allowed the dashboard — public flag on, or admin. */
export function mediaV3Enabled(isAdmin: boolean): boolean {
  return isMediaV3Public() || isAdmin
}
