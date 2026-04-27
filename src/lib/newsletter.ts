import { Resend } from "resend"

/**
 * Newsletter subscriber management. Uses Resend's Audiences API as
 * the source of truth — no local DB table, no double-opt-in flow yet
 * (Resend can be configured to send a confirmation email via its UI;
 * we'd add server-side double-opt-in if open rates / bot signups
 * become an issue).
 *
 * Free tier: Resend allows the audiences API on the hobby plan.
 * Required env: RESEND_API_KEY (already used for transactional mail),
 * RESEND_NEWSLETTER_AUDIENCE_ID (the family-news audience).
 *
 * Returns one of three statuses so the signup form can render the
 * right message: 'subscribed' (new), 'already' (idempotent retry),
 * 'error' (config missing or upstream failure).
 */

export type SubscribeResult =
  | { status: "subscribed"; email: string }
  | { status: "already"; email: string }
  | { status: "error"; reason: string }

let resend: Resend | null = null
function getResend(): Resend | null {
  if (resend) return resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  resend = new Resend(apiKey)
  return resend
}

function getAudienceId(): string | null {
  return process.env.RESEND_NEWSLETTER_AUDIENCE_ID ?? null
}

export function isNewsletterConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_NEWSLETTER_AUDIENCE_ID
}

/**
 * Add an email to the family-news audience. Idempotent: if the email
 * is already subscribed, returns 'already' rather than erroring.
 */
export async function subscribeToNewsletter(emailRaw: string): Promise<SubscribeResult> {
  const email = emailRaw.trim().toLowerCase()
  // Conservative email regex — strict enough to catch typos, lenient
  // enough to accept legitimate addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { status: "error", reason: "email invalide" }
  }
  const r = getResend()
  const audienceId = getAudienceId()
  if (!r || !audienceId) {
    return { status: "error", reason: "newsletter non configurée" }
  }

  try {
    const res = await r.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
    })
    if (res.error) {
      // Resend returns 'already_exists' (or similar) for re-submits
      // — treat as idempotent success rather than error.
      const msg = res.error.message?.toLowerCase() ?? ""
      if (msg.includes("already") || msg.includes("exist")) {
        return { status: "already", email }
      }
      return { status: "error", reason: res.error.message || "Resend error" }
    }
    return { status: "subscribed", email }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")) {
      return { status: "already", email }
    }
    return { status: "error", reason: msg }
  }
}
