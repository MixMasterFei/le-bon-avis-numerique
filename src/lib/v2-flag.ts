/**
 * Master gate for the V2 visual system (the home-redesign homepage + catalogue
 * layouts, the site-wide V2 typography, and the monogram avatars).
 *
 * V2 is admin-only until `HOMEPAGE_V2_PUBLIC=true` flips it on for everyone —
 * a single env switch with instant rollback, mirroring `TOTEM_PUBLIC` /
 * `NEWSLETTER_PUBLIC`. Keep the default OFF: the public site stays on the
 * current design until we deliberately flip.
 *
 * Pure + synchronous so it can be called from server pages (which already
 * resolve `isAdmin`) and from the root layout without an extra await.
 */
export function isV2Public(): boolean {
  return process.env.HOMEPAGE_V2_PUBLIC === "true"
}

/** True when the viewer should get V2 — public flag on, or the viewer is admin. */
export function v2Enabled(isAdmin: boolean): boolean {
  return isV2Public() || isAdmin
}
