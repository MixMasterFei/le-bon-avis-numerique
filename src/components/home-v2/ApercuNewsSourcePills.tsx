"use client"

import { APERCU_PALETTE } from "./apercuTheme"

export interface NewsSourceRef {
  name: string
  url: string
  favicon?: string
  headline?: string
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
      {visible.map((s) => (
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
          <span className="truncate max-w-[120px]">{s.name}</span>
        </a>
      ))}
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
