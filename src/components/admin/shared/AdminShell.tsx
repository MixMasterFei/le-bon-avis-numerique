"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { LayoutDashboard, Bot, Settings } from "lucide-react"
import { fraunces } from "@/components/home-v2/apercuFont"
import { adminPalette } from "./admin-ui"

export type AdminHub = "dashboard" | "totem" | "operations"

const NAV: Array<{ id: AdminHub; href: string; label: string; icon: LucideIcon }> = [
  { id: "dashboard", href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "totem", href: "/admin/totem", label: "Totem", icon: Bot },
  { id: "operations", href: "/admin/operations", label: "Opérations", icon: Settings },
]

export function AdminNavPills({ active }: { active: AdminHub }) {
  const p = adminPalette
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Navigation admin">
      {NAV.map(({ id, href, label, icon: Icon }) => {
        const isActive = id === active
        return (
          <Link
            key={id}
            href={href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              background: isActive ? p.ink : p.card,
              color: isActive ? p.bg : p.ink,
              border: `1px solid ${isActive ? p.ink : p.line}`,
            }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminShell({
  active,
  eyebrow,
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
}: {
  active: AdminHub
  eyebrow: string
  icon?: LucideIcon
  title: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const p = adminPalette
  return (
    <div className={`min-h-screen ${fraunces.variable}`} style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {Icon && <Icon className="h-5 w-5" style={{ color: p.accent }} />}
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: p.accent }}
              >
                {eyebrow}
              </span>
            </div>
            <h1
              className={`${fraunces.className} text-3xl md:text-4xl font-medium leading-[1.05]`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-2 max-w-2xl" style={{ color: p.ink2 }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>

        <AdminNavPills active={active} />

        {children}
      </div>
    </div>
  )
}
