"use client"

import { adminPalette } from "./shared/admin-ui"

const SECTIONS = [
  { id: "import", label: "Import" },
  { id: "enrich", label: "Enrichissement" },
  { id: "moderation", label: "Modération" },
  { id: "maintenance", label: "Maintenance" },
  { id: "guides", label: "Guides parents" },
  { id: "acces", label: "Accès Pilotage" },
  { id: "cron", label: "Jobs cron" },
] as const

export function OperationsSectionNav() {
  const p = adminPalette

  return (
    <nav
      className="sticky top-[4.5rem] z-20 -mx-1 px-1 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs border-b"
      style={{ background: p.bg, borderColor: p.line, color: p.ink2 }}
      aria-label="Sections opérations"
    >
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className="font-semibold hover:opacity-70 transition-opacity"
          style={{ color: p.ink }}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
