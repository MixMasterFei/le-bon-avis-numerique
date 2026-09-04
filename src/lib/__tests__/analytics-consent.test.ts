import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { trackPageview, trackQuizCompleted } from "../analytics"
import { ESSENTIAL_ONLY, WITH_ANALYTICS, saveCookieConsent } from "../cookie-consent"

const fetchMock = vi.fn().mockResolvedValue({ ok: true })

beforeEach(() => {
  saveCookieConsent(ESSENTIAL_ONLY, "declined")
  localStorage.clear()
  const browserWindow = window
  vi.stubGlobal("window", {
    location: { hostname: "totemavise.com", href: "https://totemavise.com/films" },
    localStorage: browserWindow.localStorage,
    dispatchEvent: browserWindow.dispatchEvent.bind(browserWindow),
  })
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Plausible requests", () => {
  it("sends no pageviews or custom events until consent and stops immediately on refusal", () => {
    trackPageview()
    trackQuizCompleted()
    expect(fetchMock).not.toHaveBeenCalled()
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    trackPageview()
    trackQuizCompleted()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      name: "pageview", domain: "totemavise.com", url: "https://totemavise.com/films",
    })
    saveCookieConsent(ESSENTIAL_ONLY, "declined")
    trackPageview()
    trackQuizCompleted()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not send preview or local traffic to the production account", () => {
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    window.location.hostname = "preview.vercel.app"
    trackPageview()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("strips reset/verification tokens and fragments from page URLs and referrers", () => {
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    window.location.href = "https://totemavise.com/reinitialiser-mot-de-passe?token=reset-secret#private-fragment"
    vi.spyOn(document, "referrer", "get").mockReturnValue(
      "https://totemavise.com/verifier-email?token=verification-secret#referrer-fragment",
    )
    trackPageview()
    const body = fetchMock.mock.calls[0][1].body
    expect(JSON.parse(body)).toMatchObject({
      url: "https://totemavise.com/reinitialiser-mot-de-passe",
      referrer: "https://totemavise.com/verifier-email",
    })
    expect(body).not.toMatch(/secret|fragment|token=/)
  })

  it("does not forward malformed or non-web referrers", () => {
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    vi.spyOn(document, "referrer", "get").mockReturnValue("data:text/plain,private-data")
    trackQuizCompleted()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).referrer).toBeNull()
  })

  it("does not break interactions when the analytics request fails", async () => {
    saveCookieConsent(WITH_ANALYTICS, "accepted")
    fetchMock.mockRejectedValueOnce(new Error("blocked"))
    expect(() => trackQuizCompleted()).not.toThrow()
    await Promise.resolve()
  })
})
