/**
 * Plausible custom-event helpers.
 *
 * Plausible's global `window.plausible(eventName, { props })` is loaded
 * by the snippet in `src/app/layout.tsx`. These typed wrappers keep
 * the event names + prop shapes consistent across the codebase so the
 * Plausible dashboard stays clean (no typos or mixed casing).
 */

type PlausibleProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: PlausibleProps; callback?: () => void }
    ) => void
  }
}

function fire(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return
  if (typeof window.plausible !== "function") return
  try {
    window.plausible(event, props ? { props } : undefined)
  } catch {
    // Swallow — analytics must never break the app.
  }
}

/** User completed signup (after successful POST /api/auth/register). */
export function trackSignupCompleted(method: "email" | "google" = "email") {
  fire("signup_completed", { method })
}

/** User completed the 7-step preference quiz for a family member. */
export function trackQuizCompleted() {
  fire("quiz_completed")
}

/** User voted on an expert age recommendation. */
export function trackAgeVote(agree: boolean) {
  fire("age_vote", { agree: agree ? "agree" : "disagree" })
}

/** User opened the "Adapté à mon foyer" card on a media page. */
export function trackFamilyFitRevealed() {
  fire("family_fit_revealed")
}

/** User switched between light and dark mode. */
export function trackThemeToggled(nextTheme: "light" | "dark") {
  fire("theme_toggled", { theme: nextTheme })
}

/** User clicked through from a media card to the detail page. */
export function trackMediaCardClick(
  source: "home" | "list" | "search" | "recommendations" | "similar"
) {
  fire("media_card_click", { source })
}

// ── Totem Assistant ────────────────────────────────────────────────
// Alpha-audit events: open-rate, usage volume, error frequency. Never
// includes message content.

/** User opened the Totem chat panel. */
export function trackTotemOpened(source: "dock" | "hero") {
  fire("totem_opened", { source })
}

/** User sent a chat message (count only — no content). */
export function trackTotemMessageSent() {
  fire("totem_message_sent")
}

/** Chat surfaced an error state to the user. */
export function trackTotemError(kind: "stream" | "rate_limited" | "daily_cap") {
  fire("totem_error", { kind })
}
