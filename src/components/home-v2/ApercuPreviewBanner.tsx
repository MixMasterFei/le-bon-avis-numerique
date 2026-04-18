"use client"

import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Dark ink strip that opens every /apercu* page. Reminder that the
 * route is not public, plus one-click font A/B toggle.
 */

export function ApercuPreviewBanner() {
  const p = APERCU_PALETTE
  return (
    <div
      className="text-center text-xs py-2"
      style={{ background: p.ink, color: p.bg }}
    >
      <span className="opacity-80">
        Aperçu design · non visible par les utilisateurs ·{" "}
        <a href="?font=poppins" className="underline">
          tester avec Poppins
        </a>
        {" · "}
        <a href="?" className="underline">
          revenir à Fraunces
        </a>
      </span>
    </div>
  )
}
