import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const OPTIONS = [
  { label: "Tous", value: null },
  { label: "Shounen", value: "shounen", hint: "Ados garçons" },
  { label: "Shoujo", value: "shoujo", hint: "Ados filles" },
  { label: "Seinen", value: "seinen", hint: "Adultes" },
  { label: "Josei", value: "josei", hint: "Jeunes femmes" },
] as const

/**
 * Demographic pill row for the /mangas listing. Kept server-side so each
 * pill is a real `<Link>` (SSR-friendly URL state, no JS required).
 *
 * `active` is the currently-selected demographic; `baseQuery` is the
 * serialized URLSearchParams string from the page, minus the
 * `demographic` param — we add it per pill.
 */
export function MangaDemographicPills({
  active,
  baseQuery,
}: {
  active?: string
  baseQuery: string
}) {
  const p = APERCU_PALETTE

  const buildHref = (value: string | null): string => {
    const sp = new URLSearchParams(baseQuery)
    sp.delete("demographic")
    sp.delete("page")
    if (value) sp.set("demographic", value)
    const qs = sp.toString()
    return qs ? `/mangas?${qs}` : "/mangas"
  }

  return (
    <div style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}>
      <div className="container mx-auto px-4 md:px-8 py-4 flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isActive = (active ?? null) === opt.value
          return (
            <Link
              key={opt.value ?? "all"}
              href={buildHref(opt.value)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: isActive ? p.ink : "transparent",
                color: isActive ? p.bg : p.ink,
                border: `1px solid ${isActive ? p.ink : p.line2}`,
              }}
              title={"hint" in opt ? opt.hint : undefined}
            >
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
