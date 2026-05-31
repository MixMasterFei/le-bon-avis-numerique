"use client"

import type { LucideIcon } from "lucide-react"
import { adminPalette, adminSerifClass } from "./admin-ui"

export function AdminSectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const p = adminPalette
  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="flex items-start gap-3 px-5 py-4"
        style={{ borderBottom: defaultOpen ? `1px solid ${p.line}` : undefined }}
      >
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
          style={{ background: p.bg2, color: p.accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2
            className={`${adminSerifClass} text-lg md:text-xl font-medium leading-tight`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: p.ink2 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {defaultOpen && <div className="p-5">{children}</div>}
    </section>
  )
}
