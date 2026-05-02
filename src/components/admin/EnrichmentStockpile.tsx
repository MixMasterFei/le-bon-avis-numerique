import Link from "next/link"
import { ArrowRight, Film, Tv, Gamepad2, BookOpen, BookMarked } from "lucide-react"
import type { ReactNode } from "react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { UnenrichedByType } from "@/lib/admin-kpis"

// Drillable replacement for the opaque "1069 œuvres à enrichir" card.
// Shows the total + per-type breakdown so the user knows whether the
// backlog is films, mangas, jeux, etc. before clicking through. Each
// per-type row deep-links to /admin/enrich with the matching type
// pre-selected.
//
// Data source: AdminKpis.catalogUnenrichedByType (groupBy on
// MediaItem where isEnriched=false). Sorted largest-first.

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Films",
  TV: "Séries",
  GAME: "Jeux vidéo",
  BOOK: "Livres",
  MANGA: "Mangas",
}

// /admin/enrich's selectedType state uses lowercase singular tags.
// Mapping here so the deep-link initializes the right filter.
const TYPE_TO_QUERY: Record<string, string> = {
  MOVIE: "movie",
  TV: "tv",
  GAME: "game",
  BOOK: "book",
  MANGA: "manga",
}

const TYPE_ICON: Record<string, ReactNode> = {
  MOVIE: <Film className="w-4 h-4" />,
  TV: <Tv className="w-4 h-4" />,
  GAME: <Gamepad2 className="w-4 h-4" />,
  BOOK: <BookOpen className="w-4 h-4" />,
  MANGA: <BookMarked className="w-4 h-4" />,
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

interface Props {
  serifClass: string
  total: number
  byType: UnenrichedByType[]
  /** Default is "card" (dashboard). "panel" is the wider standalone variant for /admin/operations. */
  variant?: "card" | "panel"
}

export function EnrichmentStockpile({ serifClass, total, byType, variant = "card" }: Props) {
  const p = APERCU_PALETTE
  const urgent = total > 0
  // Filter to known types and keep order; unknown types fall through with no icon/label.
  const rows = byType.filter((b) => b.count > 0)

  if (variant === "panel") {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: p.card, border: `1px solid ${p.line2}` }}
      >
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div>
            <div
              className={`${serifClass} text-4xl md:text-5xl font-medium leading-none`}
              style={{ color: urgent ? p.accent : p.ink, letterSpacing: "-0.03em" }}
            >
              {fmt(total)}
            </div>
            <div className="text-sm mt-1.5" style={{ color: p.ink2 }}>
              œuvres à enrichir au total
            </div>
          </div>
          <Link
            href="/admin/enrich"
            className="text-sm hover:opacity-70 inline-flex items-center gap-1"
            style={{ color: p.ink }}
          >
            Tout enrichir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: p.ink2 }}>
            Catalogue intégralement enrichi. Rien à faire ici.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.map((r) => {
              const queryType = TYPE_TO_QUERY[r.type]
              const href = queryType ? `/admin/enrich?type=${queryType}` : "/admin/enrich"
              return (
                <Link
                  key={r.type}
                  href={href}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: p.bg2, color: p.ink }}
                >
                  <span className="flex items-center gap-2" style={{ color: p.ink }}>
                    <span style={{ color: p.ink2 }}>{TYPE_ICON[r.type] ?? null}</span>
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  <span className="font-mono tabular-nums" style={{ color: p.ink }}>
                    {fmt(r.count)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Card variant (dashboard action queue grid) ──
  return (
    <Link
      href="/admin/enrich"
      className="group rounded-2xl p-5 flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
      style={{
        background: urgent ? p.card : "transparent",
        border: `1px solid ${urgent ? p.line2 : p.line}`,
        opacity: urgent ? 1 : 0.55,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className={`${serifClass} text-3xl font-medium leading-none mb-1`}
            style={{ color: urgent ? p.accent : p.ink, letterSpacing: "-0.03em" }}
          >
            {fmt(total)}
          </div>
          <div className="text-sm" style={{ color: p.ink }}>
            œuvres à enrichir
          </div>
        </div>
        <ArrowRight
          className="w-4 h-4 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: p.ink2 }}
        />
      </div>
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t" style={{ borderColor: p.line }}>
          {rows.slice(0, 5).map((r) => (
            <span
              key={r.type}
              className="text-xs inline-flex items-center gap-1 tabular-nums"
              style={{ color: p.ink2 }}
            >
              {fmt(r.count)} {TYPE_LABEL[r.type]?.toLowerCase() ?? r.type.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
