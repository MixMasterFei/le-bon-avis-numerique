import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { isChristmasSeason } from "@/lib/seasonal"

/**
 * One-line seasonal link above the /films and /jeux catalogues, rendered only
 * in November–December (isChristmasSeason). Out of season it renders nothing:
 * a « Noël » banner in March is the stale-site signal the seasonal gate exists
 * to prevent. Server component, so the link is in the crawled HTML.
 */
export function NoelSeasonBanner({ href, label }: { href: string; label: string }) {
  if (!isChristmasSeason()) return null
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-8">
      <Link
        href={href}
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))",
          color: "var(--color-ink)",
          border: "1px solid var(--color-line)",
        }}
      >
        <span>{label}</span>
        <span className="inline-flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
          Voir la sélection <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </div>
  )
}
