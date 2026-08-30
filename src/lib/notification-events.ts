/**
 * Client-side ping so the bell refreshes at the moment a notification is
 * created, instead of waiting for its 60 s poll.
 *
 * The "Prévenez-moi" subscription writes its confirmation notification
 * synchronously (see /api/user/release-alert), so the record exists the instant
 * the request resolves — but NotificationBell only polls every minute, which
 * made the confirmation appear up to 60 s after the click. The bell and the
 * cards that trigger notifications sit in unrelated parts of the tree, so a
 * window event keeps them decoupled: no context, no prop drilling, and any
 * future action that creates a notification can opt in with one call.
 *
 * Deliberately NOT a shorter poll interval: that would multiply requests for
 * every user all the time to fix a delay that only matters right after a click.
 */
export const NOTIFICATIONS_CHANGED = "totem:notifications-changed"

/** Ask any mounted notification bell to refetch now. No-op on the server. */
export function pingNotifications(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}
