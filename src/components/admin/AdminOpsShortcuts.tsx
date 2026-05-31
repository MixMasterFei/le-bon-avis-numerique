"use client"

import Link from "next/link"
import { Search, Sparkles, FileWarning, CalendarClock, Wrench } from "lucide-react"
import { adminPalette } from "./shared/admin-ui"

interface Props {
  onQuickImport?: () => void
}

const LINKS = [
  { href: "#import", label: "Importer", icon: Search, action: "import" as const },
  { href: "/admin/enrich", label: "Enrichir", icon: Sparkles },
  { href: "/admin/corrections", label: "Corrections", icon: FileWarning },
  { href: "#maintenance", label: "Maintenance", icon: Wrench },
  { href: "#cron", label: "Jobs cron", icon: CalendarClock },
]

export function AdminOpsShortcuts({ onQuickImport }: Props) {
  const p = adminPalette

  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map(({ href, label, icon: Icon, action }) => {
        const isImport = action === "import"
        const className =
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"

        if (isImport && onQuickImport) {
          return (
            <button
              key={label}
              type="button"
              onClick={onQuickImport}
              className={className}
              style={{ background: p.ink, color: p.bg }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          )
        }

        return (
          <Link
            key={href}
            href={href}
            className={className}
            style={{
              background: isImport ? p.ink : p.card,
              color: isImport ? p.bg : p.ink,
              border: `1px solid ${isImport ? p.ink : p.line}`,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
