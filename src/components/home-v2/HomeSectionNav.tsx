"use client"

import { APERCU_PALETTE } from "./apercuTheme"

// Quick-jump chips rendered above "Coups de cœur" so a visitor who
// arrives knowing what they want (e.g. "show me new games") can scroll
// straight to that section instead of scanning the whole page.
//
// Each chip is a plain anchor — relies on `scroll-behavior: smooth`
// (set on <html> by globals.css / layout) and `scroll-mt-*` on each
// target section to offset the sticky header height.
//
// Targets: each id corresponds to a section in HomepageApercu.tsx.
// Adding/removing a homepage section means updating this list AND
// the matching id="..." on the section wrapper.

const SECTIONS = [
  { id: "coups-de-coeur", label: "Coups de cœur" },
  { id: "cinema", label: "Au cinéma" },
  { id: "par-age", label: "Par âge" },
  { id: "streaming", label: "Streaming" },
  { id: "jeux-recents", label: "Nouveaux jeux" },
  { id: "collections", label: "Collections" },
]

export function HomeSectionNav() {
  const p = APERCU_PALETTE

  return (
    <nav
      aria-label="Sections de la page"
      className="mb-7 flex flex-wrap justify-center gap-2"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70"
          style={{
            background: p.card,
            border: `1px solid ${p.line2}`,
            color: p.ink,
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  )
}
