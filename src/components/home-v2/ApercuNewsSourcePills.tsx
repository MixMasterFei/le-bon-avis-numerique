"use client"

import { APERCU_PALETTE } from "./apercuTheme"

export interface NewsSourceRef {
  name: string
  url: string
  favicon?: string
  headline?: string
  /** ISO 3166-1 alpha-2 country code for INTL sources (UK normalised
   *  to GB internally for emoji-flag generation). Drives the small
   *  flag rendered in the pill for international stories. */
  country?: string
}

// EU-27 member-state ISO 3166-1 alpha-2 codes. UK excluded (Brexit
// finalised 2020). Used to add the 🇪🇺 flag alongside the country
// flag — Xavier's preference: parents want to know which country
// the news comes from, with the EU context as a secondary signal.
const EU_MEMBERS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE",
])

/**
 * Convert an ISO 3166-1 alpha-2 code to its emoji flag using the
 * regional indicator symbols block (U+1F1E6..U+1F1FF). Returns "" for
 * invalid codes. "UK" is normalised to "GB" (the legacy code we use
 * in news-sources). "EU" produces the 🇪🇺 flag via the same
 * regional-indicator-symbol trick.
 */
function flagOf(code: string): string {
  const cc = code.toUpperCase() === "UK" ? "GB" : code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ""
  return (
    String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + cc.charCodeAt(1) - 65)
  )
}

/**
 * Returns the flags to render for a given source country, in render
 * order. EU member states (excluding UK) get their own flag plus 🇪🇺.
 * "EU" generic sources (Cineuropa) → just 🇪🇺. Non-EU INTL → just
 * the country flag.
 */
function countryFlags(code: string | undefined): string[] {
  if (!code) return []
  const cc = code.toUpperCase()
  if (cc === "EU") return [flagOf("EU")].filter(Boolean)
  const main = flagOf(cc)
  if (!main) return []
  if (EU_MEMBERS.has(cc === "UK" ? "GB" : cc)) {
    return [main, flagOf("EU")]
  }
  return [main]
}

export function ApercuNewsSourcePills({
  sources,
  compact = false,
}: {
  sources: NewsSourceRef[]
  compact?: boolean
}) {
  const p = APERCU_PALETTE
  if (!sources.length) return null

  const visible = compact ? sources.slice(0, 3) : sources
  const extra = compact && sources.length > 3 ? sources.length - 3 : 0

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((s) => {
        const flags = countryFlags(s.country)
        return (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ background: p.bg2, color: p.ink, border: `1px solid ${p.line}` }}
            title={s.headline ?? s.name}
          >
            {s.favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.favicon} alt="" className="w-3 h-3 rounded-sm" />
            )}
            <span className="truncate max-w-[140px]">{s.name}</span>
            {flags.length > 0 && (
              <span className="text-[12px] leading-none whitespace-nowrap" aria-hidden>
                {flags.join(" ")}
              </span>
            )}
          </a>
        )
      })}
      {extra > 0 && (
        <span
          className="text-[11px] font-medium"
          style={{ color: p.ink2 }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
