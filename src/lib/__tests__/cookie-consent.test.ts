import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  COOKIE_CONSENT_KEY,
  ESSENTIAL_ONLY,
  WITH_ANALYTICS,
  allowConsentedAnalytics,
  getCookieConsent,
  getServerCookieConsent,
  hasAnalyticsConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from "../cookie-consent"

beforeEach(() => {
  saveCookieConsent(ESSENTIAL_ONLY, "declined")
  localStorage.clear()
})

afterEach(() => vi.restoreAllMocks())

describe("cookie consent enforcement", () => {
  it("denies analytics before a choice, including server rendering", () => {
    expect(hasAnalyticsConsent()).toBe(false)
    expect(getCookieConsent().choice).toBe("pending")
    expect(getServerCookieConsent().preferences.analytics).toBe(false)
  })

  it.each([
    "{broken", "null", "true", "[]",
    JSON.stringify({ version: 2, choice: "accepted", analytics: true }),
    JSON.stringify({ version: 1, choice: "accepted", analytics: "true" }),
    JSON.stringify({ version: 1, choice: "declined", analytics: true }),
    JSON.stringify({ version: 1, choice: "unknown", analytics: true }),
  ])("does not grant consent for malformed stored data: %s", (value) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, value)
    expect(hasAnalyticsConsent()).toBe(false)
    expect(getCookieConsent().choice).toBe("pending")
  })

  it("honors valid legacy preferences without enabling unused marketing", () => {
    localStorage.setItem("cookie-consent", "accepted")
    localStorage.setItem("cookie-preferences", JSON.stringify({ analytics: true, marketing: true }))
    expect(getCookieConsent().preferences).toEqual(WITH_ANALYTICS)
    saveCookieConsent(ESSENTIAL_ONLY, "declined")
    expect(localStorage.getItem("cookie-consent")).toBeNull()
    expect(localStorage.getItem("cookie-preferences")).toBeNull()
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("does not infer consent from a legacy marker alone", () => {
    localStorage.setItem("cookie-consent", "accepted")
    expect(hasAnalyticsConsent()).toBe(false)
    localStorage.setItem("cookie-preferences", '{"analytics":"false"}')
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("immediately informs this tab and filters provider events after revocation", () => {
    const observed: boolean[] = []
    const unsubscribe = subscribeCookieConsent(() => observed.push(hasAnalyticsConsent()))
    const event = { url: "https://totemavise.com/films" }
    const providerCallback = allowConsentedAnalytics
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    expect(providerCallback(event)).toBe(event)
    saveCookieConsent(ESSENTIAL_ONLY, "customized")
    expect(providerCallback(event)).toBeNull()
    expect(observed).toEqual([true, false])
    unsubscribe()
  })

  it("propagates other-tab choices and storage clearing", () => {
    const observed: boolean[] = []
    const unsubscribe = subscribeCookieConsent(() => observed.push(hasAnalyticsConsent()))
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: 1, choice: "accepted", analytics: true }))
    window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_KEY }))
    localStorage.clear()
    window.dispatchEvent(new StorageEvent("storage", { key: null }))
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-setting" }))
    expect(observed).toEqual([true, false])
    unsubscribe()
  })

  it("fails closed when storage cannot be read and applies revocation if saving fails", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    expect(hasAnalyticsConsent()).toBe(false)
    getItem.mockRestore()
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })
    expect(saveCookieConsent(ESSENTIAL_ONLY, "declined")).toBe(false)
    expect(hasAnalyticsConsent()).toBe(false)
  })
})
