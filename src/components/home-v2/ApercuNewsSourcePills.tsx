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

/**
 * Convert an ISO 3166-1 alpha-2 code to its emoji flag using the
 * regional indicator symbols block (U+1F1E6..U+1F1FF). Accepts the
 * legacy "UK" code we use in news-sources by mapping it to "GB".
 */
function countryFlag(code: string | undefined): string {
  if (!code) return ""
  const cc = code.toUpperCase() === "UK" ? "GB" : code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ""
  return (
    String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + cc.charCodeAt(1) - 65)
  )
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
        const flag = countryFlag(s.country)
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
            {flag && <span className="text-[12px] leading-none" aria-hidden>{flag}</span>}
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
