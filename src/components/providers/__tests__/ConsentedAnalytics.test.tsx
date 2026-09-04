import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConsentedAnalytics } from "../ConsentedAnalytics"
import { CookieConsent } from "@/components/CookieConsent"
import CookiesPage from "@/app/cookies/page"
import { COOKIE_CONSENT_KEY, ESSENTIAL_ONLY, getCookieConsent, saveCookieConsent } from "@/lib/cookie-consent"

const providers = vi.hoisted(() => ({
  analytics: vi.fn(),
  speed: vi.fn(),
  pageview: vi.fn(),
}))
vi.mock("@vercel/analytics/react", () => ({
  Analytics: (props: unknown) => { providers.analytics(props); return <span data-testid="analytics" /> },
}))
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: (props: unknown) => { providers.speed(props); return <span data-testid="speed-insights" /> },
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/films" }))
vi.mock("@/lib/analytics", () => ({ trackPageview: providers.pageview }))

beforeEach(() => {
  saveCookieConsent(ESSENTIAL_ONLY, "declined")
  localStorage.clear()
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("consent controls and providers", () => {
  it("loads providers on banner acceptance and stops them when the cookie page revokes consent", () => {
    render(<><CookieConsent /><ConsentedAnalytics /><CookiesPage /></>)
    act(() => vi.advanceTimersByTime(800))
    expect(screen.queryByTestId("analytics")).not.toBeInTheDocument()
    expect(screen.queryByTestId("speed-insights")).not.toBeInTheDocument()
    expect(providers.pageview).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /^Tout accepter$/ }))
    expect(screen.getByTestId("analytics")).toBeInTheDocument()
    expect(screen.getByTestId("speed-insights")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Tout accepter$/ })).not.toBeInTheDocument()
    expect(providers.pageview).toHaveBeenCalledTimes(1)
    const beforeSendAnalytics = providers.analytics.mock.lastCall![0].beforeSend
    const beforeSendSpeed = providers.speed.mock.lastCall![0].beforeSend
    const event = { url: "https://totemavise.com/films" }
    expect(beforeSendAnalytics(event)).toBe(event)

    fireEvent.click(screen.getByRole("button", { name: "Refuser les cookies non essentiels" }))
    // Already-loaded SDKs remain mounted for route bookkeeping. Their retained
    // callbacks must reject both usage and performance events after refusal.
    expect(beforeSendAnalytics(event)).toBeNull()
    expect(beforeSendAnalytics({ ...event, type: "event" })).toBeNull()
    expect(beforeSendSpeed({ ...event, type: "vital" })).toBeNull()
    expect(getCookieConsent().preferences.analytics).toBe(false)

    fireEvent.click(screen.getByRole("button", { name: "Accepter tous les cookies" }))
    expect(beforeSendAnalytics(event)).toBe(event)
    expect(providers.pageview).toHaveBeenCalledTimes(2)
  })

  it("customized consent enables only analytics and follows changes from another tab", () => {
    render(<><CookieConsent /><ConsentedAnalytics /></>)
    act(() => vi.advanceTimersByTime(800))
    fireEvent.click(screen.getByRole("button", { name: "Personnaliser" }))
    expect(screen.getByRole("checkbox", { name: "Marketing non utilisé" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Autoriser la mesure d’audience" }))
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }))
    expect(getCookieConsent().preferences).toEqual({ essential: true, analytics: true, marketing: false })
    expect(screen.getByTestId("analytics")).toBeInTheDocument()
    act(() => {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: 1, choice: "declined", analytics: false }))
      window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_KEY }))
    })
    expect(providers.analytics.mock.lastCall![0].beforeSend({ type: "pageview", url: "/films" })).toBeNull()
    expect(providers.speed.mock.lastCall![0].beforeSend({ type: "vital", url: "/films" })).toBeNull()
  })

  it("keeps analytics off when all cookies are refused", () => {
    render(<><CookieConsent /><ConsentedAnalytics /></>)
    act(() => vi.advanceTimersByTime(800))
    fireEvent.click(screen.getByRole("button", { name: "Tout refuser" }))
    expect(getCookieConsent().choice).toBe("declined")
    expect(providers.analytics).not.toHaveBeenCalled()
    expect(providers.speed).not.toHaveBeenCalled()
    expect(providers.pageview).not.toHaveBeenCalled()
  })
})
