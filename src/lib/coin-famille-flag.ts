/**
 * Gate for "Le Coin Famille" — the daily family home base (`/coin-famille`).
 *
 * Admin-only during build-out; flip `COIN_FAMILLE_PUBLIC=true` in Vercel to
 * open it to all authenticated users. Mirrors TOTEM_PUBLIC /
 * HOMEPAGE_V2_PUBLIC / MEDIA_V3_PUBLIC. Keep the default OFF: while off, the
 * page 404s for non-admins and the nav button is hidden.
 *
 * Note: at public launch, also wire the post-login redirect to /coin-famille
 * (currently /profil) — the safeCallback defaults in /connexion + /inscription.
 *
 * Pure + synchronous so server pages can call it after resolving `isAdmin`.
 */
export function isCoinFamillePublic(): boolean {
  // PUBLIC since July 2026 (kill-switch: set COIN_FAMILLE_PUBLIC="false" to
  // fall back to admin-only — inverted flag, mirrors NEXT_PUBLIC_POSTER_ACTIONS).
  return process.env.COIN_FAMILLE_PUBLIC !== "false"
}

/** True when the viewer may see Le Coin Famille — public flag on, or admin. */
export function coinFamilleEnabled(isAdmin: boolean): boolean {
  return isCoinFamillePublic() || isAdmin
}
