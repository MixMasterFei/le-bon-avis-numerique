/**
 * Gate for the per-game Parents' Guide (/jeux/guide/[key]).
 *
 * Admin-only until `GAME_GUIDES_PUBLIC=true`, mirroring `HOMEPAGE_V2_PUBLIC`
 * and `TOTEM_PUBLIC`: one env switch, instant rollback, default OFF.
 *
 * The default matters more than usual here. A guide that tells a parent a
 * control is in place when it is not does real harm, so these pages stay
 * behind the flag until each one has been read end to end by a human.
 *
 * Pure + synchronous so server pages that already resolved `isAdmin` can call
 * it without an extra await.
 */
export function isGameGuidePublic(): boolean {
  return process.env.GAME_GUIDES_PUBLIC === "true"
}

/** True when the viewer should see the guides — flag on, or viewer is admin. */
export function gameGuideEnabled(isAdmin: boolean): boolean {
  return isGameGuidePublic() || isAdmin
}
