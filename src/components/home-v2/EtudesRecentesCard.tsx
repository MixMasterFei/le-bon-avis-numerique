"use client"

import { ExternalLink, FlaskConical } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

export interface EtudeRef {
  organization: string  // "Pew Research Center", "INSERM", "Cairn"
  title: string         // Study/report title
  url: string           // Direct link to the study or institutional page
  date?: string         // "avril 2026" — display only
}

/**
 * Sidebar block: "Études récentes" — links directly out to scientific /
 * institutional sources we trust, family-framed. The list is curated,
 * not LLM-generated, so the references stay verifiable.
 *
 * Sourced means: each entry has a real institution + a real URL the
 * reader can click. No synthesized "as the experts say" claims.
 */
export function EtudesRecentesCard({
  etudes,
  serifClass,
}: {
  etudes: EtudeRef[]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  if (etudes.length === 0) return null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.accent2, color: "#FFFFFF" }}
      >
        <FlaskConical className="w-3 h-3" />
        Études récentes
      </div>
      <ul className="flex flex-col gap-3">
        {etudes.slice(0, 4).map((e, i) => (
          <li key={i}>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block hover:opacity-70 transition-opacity"
            >
              <div
                className={`${serifClass} text-sm leading-snug font-medium mb-0.5`}
                style={{ color: p.ink, letterSpacing: "-0.01em" }}
              >
                {e.title}
              </div>
              <div className="text-[11px] flex items-center gap-1.5" style={{ color: p.ink2 }}>
                <span>{e.organization}</span>
                {e.date && <span>· {e.date}</span>}
                <ExternalLink className="w-3 h-3 ml-auto" />
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
