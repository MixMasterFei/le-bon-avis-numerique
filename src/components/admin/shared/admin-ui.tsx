"use client"

import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { fraunces } from "@/components/home-v2/apercuFont"

export const adminPalette = APERCU_PALETTE
export const adminSerifClass = fraunces.className

export const CHART_COLORS = ["#C4785A", "#5C8A5C", "#6B7FA8", "#9B8AA5", "#D4A574", "#8B7355"]

export function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

export function wowLabel(
  current: number,
  prev: number,
): { text: string; tone: "up" | "down" | "neutral" } {
  if (prev === 0 && current === 0) return { text: "—", tone: "neutral" }
  if (prev === 0) return { text: `+${current}`, tone: "up" }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { text: "stable", tone: "neutral" }
  return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, tone: pct > 0 ? "up" : "down" }
}

export function chartTooltipStyle() {
  const p = adminPalette
  return {
    background: p.card,
    border: `1px solid ${p.line2}`,
    borderRadius: 8,
    fontSize: 12,
  }
}

export function AdminCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const p = adminPalette
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      {children}
    </div>
  )
}

export function AdminKpiTile({
  label,
  value,
  sub,
  wow,
}: {
  label: string
  value: string
  sub?: string
  wow?: { text: string; tone: "up" | "down" | "neutral" }
}) {
  const p = adminPalette
  const wowStyle =
    wow?.tone === "up"
      ? { color: "#3E6640", background: "rgba(92,138,92,0.12)" }
      : wow?.tone === "down"
        ? { color: p.accent, background: "rgba(209,106,74,0.12)" }
        : { color: p.ink2, background: "rgba(30,26,21,0.06)" }

  return (
    <AdminCard>
      <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: p.ink2 }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={`${adminSerifClass} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        {wow && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={wowStyle}>
            {wow.text}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: p.ink2 }}>
          {sub}
        </div>
      )}
    </AdminCard>
  )
}

export function AdminBtn({
  children,
  onClick,
  disabled,
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md"
  type?: "button" | "submit"
  className?: string
}) {
  const p = adminPalette
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
  const style =
    variant === "primary"
      ? { background: p.ink, color: p.bg, border: `1px solid ${p.ink}` }
      : variant === "ghost"
        ? { background: "transparent", color: p.ink2, border: "none" }
        : { background: p.card, color: p.ink, border: `1px solid ${p.line}` }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${pad} ${className}`}
      style={style}
    >
      {children}
    </button>
  )
}

export function AdminSectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const p = adminPalette
  return (
    <div className="mb-4">
      <h2
        className={`${adminSerifClass} text-lg md:text-xl font-medium`}
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
  )
}
