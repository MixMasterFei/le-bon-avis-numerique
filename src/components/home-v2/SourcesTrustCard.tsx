"use client"

import { Shield } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Sidebar block: "Sources de confiance" — small list of the
 * publications we draw from. Transparency play: reader sees we're
 * pulling from real outlets, not LLM-fabricated content.
 *
 * For the Aperçu we list a small curated subset. Could later auto-
 * populate from the actual NEWS_SOURCES list at build time.
 */
export function SourcesTrustCard({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE

  const sources = [
    "Le Monde · La Croix · Télérama · 20 Minutes",
    "Franceinfo · France Culture · Numerama · AlloCiné",
    "Pew Research · BBC · The Guardian · NYT",
    "Common Sense Media · Pédagojeux · 1jour1actu",
  ]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.bg2, color: p.ink }}
      >
        <Shield className="w-3 h-3" />
        Sources de confiance
      </div>
      <p className="text-xs mb-3" style={{ color: p.ink2 }}>
        Chaque actualité est synthétisée à partir de la presse française et internationale spécialisée famille.
      </p>
      <ul className={`${serifClass} flex flex-col gap-1.5 text-xs`} style={{ color: p.ink }}>
        {sources.map((row, i) => (
          <li key={i} className="leading-relaxed">
            {row}
          </li>
        ))}
      </ul>
    </div>
  )
}
