export interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

type ConsentChoice = "accepted" | "declined" | "customized"

export interface CookieConsentState {
  choice: ConsentChoice | "pending"
  preferences: CookiePreferences
}

export const COOKIE_CONSENT_KEY = "totem-cookie-consent-v1"
const CHANGE_EVENT = "totem-cookie-consent-change"

export const ESSENTIAL_ONLY: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
}
export const WITH_ANALYTICS: CookiePreferences = { ...ESSENTIAL_ONLY, analytics: true }

// Stable snapshots for useSyncExternalStore; absent, invalid or inaccessible
// storage never grants consent. Marketing is not used by this site.
const PENDING: CookieConsentState = { choice: "pending", preferences: ESSENTIAL_ONLY }
const ACCEPTED: CookieConsentState = { choice: "accepted", preferences: WITH_ANALYTICS }
const DECLINED: CookieConsentState = { choice: "declined", preferences: ESSENTIAL_ONLY }
const CUSTOM_ALLOWED: CookieConsentState = { choice: "customized", preferences: WITH_ANALYTICS }
const CUSTOM_DENIED: CookieConsentState = { choice: "customized", preferences: ESSENTIAL_ONLY }

let memoryChoice: CookieConsentState | undefined

function stateFor(choice: unknown, analytics: unknown): CookieConsentState {
  if (typeof analytics !== "boolean") return PENDING
  if (choice === "accepted" && analytics) return ACCEPTED
  if (choice === "declined" && !analytics) return DECLINED
  if (choice === "customized") return analytics ? CUSTOM_ALLOWED : CUSTOM_DENIED
  return PENDING
}

export function getServerCookieConsent(): CookieConsentState {
  return PENDING
}

export function getCookieConsent(): CookieConsentState {
  if (typeof window === "undefined") return PENDING
  if (memoryChoice) return memoryChoice
  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored)
      if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1) {
        return PENDING
      }
      if (!("choice" in parsed) || !("analytics" in parsed)) return PENDING
      return stateFor(parsed.choice, parsed.analytics)
    }

    // Respect existing explicit choices, but never infer consent from a lone
    // marker or coerce malformed preferences (e.g. the string "false").
    const legacyChoice = window.localStorage.getItem("cookie-consent")
    const legacyPreferences: unknown = JSON.parse(window.localStorage.getItem("cookie-preferences") || "null")
    if (!legacyPreferences || typeof legacyPreferences !== "object" || !("analytics" in legacyPreferences)) {
      return PENDING
    }
    return stateFor(legacyChoice, legacyPreferences.analytics)
  } catch {
    return PENDING
  }
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent().preferences.analytics
}

/** Provider callbacks consult the current choice, including after unmount. */
export function allowConsentedAnalytics<T>(event: T): T | null {
  return hasAnalyticsConsent() ? event : null
}

/** Returns whether the choice was persisted; it always applies in this tab. */
export function saveCookieConsent(preferences: CookiePreferences, choice: ConsentChoice): boolean {
  if (typeof window === "undefined") return false
  const next = stateFor(choice, preferences.analytics === true)
  let persisted = false
  try {
    // A single atomic record avoids transient acceptance between two writes.
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      version: 1,
      choice: next.choice,
      analytics: next.preferences.analytics,
    }))
    persisted = true
    memoryChoice = undefined
    window.localStorage.removeItem("cookie-consent")
    window.localStorage.removeItem("cookie-preferences")
  } catch {
    // Private mode / full storage must not break the controls or revocation.
    memoryChoice = next
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return persisted
}

export function subscribeCookieConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || [COOKIE_CONSENT_KEY, "cookie-consent", "cookie-preferences"].includes(event.key)) {
      memoryChoice = undefined
      onChange()
    }
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}
