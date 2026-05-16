"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Small nav strip below the preview banner. Lets the reviewer hop
 * between /apercu* pages without typing URLs. Muted styling — it's
 * scaffolding, not product UI.
 */

interface ApercuRoute {
  href: string
  label: string
}

// Trimmed to routes that actually exist. /apercu, /apercufilmslist,
// /apercuinscription, /apercuquiz were removed earlier — keeping
// dead links here triggers RSC-prefetch 404s in the console.
const ROUTES: ApercuRoute[] = [
  { href: "/apercufilm", label: "Fiche film" },
  { href: "/apercufoyer", label: "Foyer" },
  { href: "/apercudecouverte", label: "Découverte" },
  { href: "/apercudecouverte-v3", label: "Découverte v3" },
  { href: "/apercudecouverte-v4", label: "Découverte v4" },
]

export function ApercuNav() {
  const pathname = usePathname()
  const p = APERCU_PALETTE
  return (
    <div
      className="border-b"
      style={{ background: p.bg2, borderColor: p.line }}
    >
      <div className="container mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span
          className="uppercase tracking-wide font-semibold"
          style={{ color: p.ink2 }}
        >
          Aperçus
        </span>
        {ROUTES.map((r) => {
          // Match exact path OR any sub-path (so /apercudecouverte/actualites
          // and /apercudecouverte/[slug] light up the "Découverte" entry).
          // The "+ '/'" boundary is what prevents /apercudecouverte from
          // false-matching /apercudecouverte-v3 — the dash never starts a
          // sub-path segment.
          const active = pathname === r.href || pathname.startsWith(r.href + "/")
          return (
            <Link
              key={r.href}
              href={r.href}
              className="transition-opacity hover:opacity-100"
              style={{
                color: active ? p.accent : p.ink2,
                fontWeight: active ? 600 : 500,
                opacity: active ? 1 : 0.8,
              }}
            >
              {r.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
