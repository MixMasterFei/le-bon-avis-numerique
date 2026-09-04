/**
 * Plausible custom-event helpers.
 *
 * Uses the documented Events API so every request checks current consent.
 * The hosted tracker keeps engagement listeners after unmount and those
 * requests bypass transformRequest, so it cannot safely handle revocation.
 * https://plausible.io/docs/events-api
 */

import { hasAnalyticsConsent } from "@/lib/cookie-consent"

type PlausibleProps = Record<string, string | number | boolean>

function analyticsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    // Reset/verification tokens and other personal data can appear in search
    // parameters or fragments. Neither page URLs nor referrers may send them.
    return `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

function fire(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return
  if (!hasAnalyticsConsent()) return
  // Keep local development and preview deployments out of production stats.
  if (!["totemavise.com", "www.totemavise.com"].includes(window.location.hostname)) return
  const url = analyticsUrl(window.location.href)
  if (!url) return
  try {
    void fetch("https://plausible.io/api/event", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({
        name: event,
        domain: "totemavise.com",
        url,
        referrer: analyticsUrl(document.referrer),
        ...(props ? { props } : {}),
      }),
    }).catch(() => { /* Analytics must never break the app. */ })
  } catch {
    // Swallow — analytics must never break the app.
  }
}

/** Initial view after consent and subsequent client-side route changes. */
export function trackPageview() {
  fire("pageview")
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
