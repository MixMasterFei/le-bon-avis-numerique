"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { trackThemeToggled } from "@/lib/analytics"

type Theme = "light" | "dark"

/**
 * Sun/Moon toggle for light ↔ dark mode.
 *
 * - First visit: inherits `prefers-color-scheme` (set by the blocking
 *   script in layout.tsx before first paint).
 * - On toggle: flips `document.documentElement.dataset.theme` and
 *   persists the choice in `localStorage.theme`.
 * - Persists across sessions. Clearing localStorage reverts to system.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const p = APERCU_PALETTE
  const [theme, setTheme] = useState<Theme | null>(null)

  // Sync from the attribute set by the blocking script. We don't trust
  // SSR for this — the server doesn't know the user's localStorage.
  // Defer to microtask to avoid cascading renders (React 19 rule).
  useEffect(() => {
    queueMicrotask(() => {
      const current = document.documentElement.dataset.theme
      setTheme(current === "dark" ? "dark" : "light")
    })
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("theme", next)
    } catch {
      // localStorage can throw in private mode / quota — non-fatal.
    }
    setTheme(next)
    trackThemeToggled(next)
  }

  // Render a neutral placeholder until we know the theme (one paint).
  // Prevents the icon from flashing from sun to moon on first mount.
  const isDark = theme === "dark"
  const Icon = isDark ? Sun : Moon
  const label = isDark
    ? "Passer en mode clair"
    : "Passer en mode sombre"

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      // 44×44px — WCAG touch-target minimum (36px failed the Lighthouse
      // "touch targets" audit next to the adjacent search field).
      className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-opacity hover:opacity-70 ${className ?? ""}`}
      style={{
        // Subtle cream/near-black pill so the toggle reads as a
        // distinct chip instead of blending with the header.
        background: p.bg2,
        color: p.ink,
        border: `1px solid ${p.line}`,
      }}
    >
      {theme === null ? (
        // Invisible placeholder so layout doesn't shift before hydration.
        <span className="block w-4 h-4" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </button>
  )
}
