// Feature flag for the quick "poster actions" bar (à voir / déjà vu / adoré /
// pas pour nous on any media poster, site-wide).
//
// PUBLIC since 2026-07 (validated admin-only first). ON for every logged-in
// user; the bar itself still requires a session (logged-out users see nothing
// until the anonymous→signup gate ships). Kill-switch: set
// NEXT_PUBLIC_POSTER_ACTIONS="false" to fall back to off. Must be NEXT_PUBLIC_
// so the gate resolves client-side, where the bar renders.
export function posterActionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POSTER_ACTIONS !== "false"
}
