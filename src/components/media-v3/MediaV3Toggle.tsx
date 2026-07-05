"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"

/**
 * Admin-only chip to flip between the classic media fiche and the V3
 * "scoreboard dashboard" preview (`/media/<routeId>/apercu`). Self-hides for
 * non-admins so it can live on the public (ISR) classic page without leaking
 * the preview. Mirrors AdminVariantToggle.
 */
export function MediaV3Toggle({
  variant,
  routeId,
}: {
  variant: "classic" | "dashboard"
  routeId: string
}) {
  const { data: session } = useSession()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") return null

  const toDashboard = variant === "classic"
  const href = toDashboard ? `/media/${routeId}/apercu` : `/media/${routeId}`

  return (
    <Link
      href={href}
      className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-lg sm:left-1/2 sm:-translate-x-1/2"
      style={{
        background: "var(--color-card)",
        color: "var(--color-ink)",
        border: "1px solid var(--color-line2)",
      }}
    >
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
        style={{ background: "var(--color-accent)" }}
      >
        Admin
      </span>
      {toDashboard ? "Voir la fiche dashboard →" : "Revenir à la fiche classique"}
    </Link>
  )
}
