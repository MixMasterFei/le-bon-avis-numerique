// Feature flag for the quick "poster actions" bar (à voir / déjà vu / adoré
// on any media poster, site-wide). Admin-only by default so Xavier can test
// the interaction and data capture before a public rollout — mirrors
// COIN_FAMILLE_PUBLIC / TOTEM_PUBLIC / HOMEPAGE_V2_PUBLIC.
//
// Flip on for everyone by setting NEXT_PUBLIC_POSTER_ACTIONS="true" (must be
// NEXT_PUBLIC_ so the gate resolves client-side, where the bar renders).
export function posterActionsEnabled(isAdmin: boolean): boolean {
  if (process.env.NEXT_PUBLIC_POSTER_ACTIONS === "true") return true
  return isAdmin
}
