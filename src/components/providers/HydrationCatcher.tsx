"use client"

import { useEffect, useState } from "react"

interface CapturedError {
  message: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
  consoleArgs?: string[]
}

/**
 * Catches React 19 hydration mismatches via TWO paths:
 *
 *   1. window.addEventListener("error") — fires for the uncaught
 *      error #418 (recoverable hydration errors in React 19 don't
 *      reach ErrorBoundaries; they bubble to window).
 *   2. console.error patch — captures any React warning that fires
 *      BEFORE the throw (mostly stripped in prod but kept defensively).
 *
 * Renders a fixed red banner at the top of the page with the captured
 * payload so we can read it without DevTools and copy/paste. Temporary
 * debugging aid — remove once the V3 hydration bug is fixed.
 */
export function HydrationCatcher() {
  const [captured, setCaptured] = useState<CapturedError | null>(null)

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = event.message ?? String(event.error ?? "")
      // Only surface React errors — let other window errors pass through.
      if (msg.includes("Minified React error") || msg.includes("Hydration") || msg.includes("hydrat")) {
        // eslint-disable-next-line no-console
        console.error(
          "%c[HYDRATION CATCHER — window.error]",
          "background:#ff0000;color:#fff;padding:4px 8px;font-weight:bold;font-size:14px",
          "\n\nMessage:", msg,
          "\nFile:", event.filename, ":", event.lineno, ":", event.colno,
          "\n\nStack:", event.error?.stack,
        )
        setCaptured({
          message: msg,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        })
      }
    }
    window.addEventListener("error", onError)

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
          orig.call(
            console,
            "%c[HYDRATION CATCHER — console.error]",
            "background:#ff0000;color:#fff;padding:4px 8px;font-weight:bold;font-size:14px",
            "\n\nargs:\n", ...args,
            "\n\nstack:\n", new Error("hydration-trace").stack,
          )
          setCaptured((prev) =>
            prev ?? { message: text, consoleArgs: args.map((a) => String(a)) },
          )
          return
        }
      } catch {
        // never let the patch itself throw
      }
      orig.apply(console, args)
    }

    return () => {
      window.removeEventListener("error", onError)
      console.error = orig
    }
  }, [])

  if (!captured) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "#ff0000",
        color: "#fff",
        padding: "12px 16px",
        fontFamily: "monospace",
        fontSize: "12px",
        maxHeight: "60vh",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      <strong style={{ fontSize: "14px" }}>[HYDRATION CATCHER]</strong>
      {"\n"}
      <strong>Message:</strong> {captured.message}
      {captured.filename ? `\n\nFile: ${captured.filename}:${captured.lineno}:${captured.colno}` : ""}
      {captured.stack ? `\n\nStack:\n${captured.stack}` : ""}
      {captured.consoleArgs ? `\n\nConsole args:\n${captured.consoleArgs.join("\n---\n")}` : ""}
    </div>
  )
}
