"use client"

import { useEffect } from "react"

/**
 * Patches console.error to surface the un-minified hydration mismatch
 * warning from React, which gets called BEFORE error #418 is thrown.
 * In production the dev-only warnings are stripped, but the recoverable
 * error path still calls console.error with useful info — we just need
 * to make sure we see and dump the full component stack.
 *
 * This is a debugging aid intended to be temporary while hunting a
 * specific hydration bug on /apercudecouverte-v3. Remove the import
 * from layout.tsx once the underlying mismatch is fixed.
 */
export function HydrationCatcher() {
  useEffect(() => {
    const orig = console.error
    console.error = (...args: unknown[]) => {
      try {
        const first = args[0]
        const text = typeof first === "string" ? first : ""
        if (
          text.includes("Hydration") ||
          text.includes("hydration") ||
          text.includes("did not match") ||
          text.includes("#418") ||
          text.includes("#419") ||
          text.includes("#421") ||
          text.includes("#422") ||
          text.includes("#423") ||
          text.includes("#425")
        ) {
          // Surface in a way that's hard to miss in the console.
          orig.call(
            console,
            "%c[HYDRATION MISMATCH CAUGHT]",
            "background: #ff0000; color: #fff; padding: 4px 8px; font-weight: bold;",
            "\n\nargs:\n",
            ...args,
            "\n\nstack:\n",
            new Error("hydration-trace").stack,
          )
          return
        }
      } catch {
        // never let the patch itself throw
      }
      orig.apply(console, args)
    }
    return () => {
      console.error = orig
    }
  }, [])
  return null
}
