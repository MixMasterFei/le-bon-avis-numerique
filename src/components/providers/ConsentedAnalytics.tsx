"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { trackPageview } from "@/lib/analytics"
import {
  allowConsentedAnalytics,
  getCookieConsent,
  getServerCookieConsent,
  subscribeCookieConsent,
} from "@/lib/cookie-consent"

export function ConsentedAnalytics() {
  const consent = useSyncExternalStore(subscribeCookieConsent, getCookieConsent, getServerCookieConsent)
  const pathname = usePathname()
  const lastPageview = useRef<string | null>(null)
  const allowed = consent.preferences.analytics
  const [sdkStarted, setSdkStarted] = useState(false)

  // Start once after an explicit grant. These SDKs retain their injected
  // scripts; keeping their components mounted preserves SPA route updates
  // if consent is withdrawn and granted again later in the same visit.
  if (allowed && !sdkStarted) setSdkStarted(true)

  useEffect(() => {
    if (!allowed) {
      lastPageview.current = null
      return
    }
    if (pathname && lastPageview.current !== pathname) {
      lastPageview.current = pathname
      trackPageview()
    }
  }, [allowed, pathname])

  if (!sdkStarted) return null

  return (
    <>
      {/* Each send must check current consent, including during refusal;
          a captured `allowed` boolean would become stale. */}
      <Analytics beforeSend={allowConsentedAnalytics} />
      <SpeedInsights beforeSend={allowConsentedAnalytics} />
    </>
  )
}
