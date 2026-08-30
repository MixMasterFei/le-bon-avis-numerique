import { v2FontVars } from "@/components/home-redesign/fonts"

/**
 * Streamed while the interpretation + catalogue queries run. Mirrors the real
 * layout (headline block, chip row, poster grid) so the page settles into place
 * instead of jumping — the perceived speed of the whole feature lives here.
 */
export function DecouverteSkeleton({ query }: { query?: string }) {
  return (
    <div
      data-home="v2"
      className={`${v2FontVars} min-h-screen`}
      style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
        {query ? (
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
            Nous composons votre sélection…
          </p>
        ) : (
          <div className="h-4 w-48 animate-pulse rounded" style={{ background: "var(--placeholder, #E6DFCE)" }} />
        )}

        <div className="mt-4 h-10 w-3/4 max-w-[640px] animate-pulse rounded" style={{ background: "var(--placeholder, #E6DFCE)" }} />

        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-32 animate-pulse rounded-full" style={{ background: "var(--placeholder, #E6DFCE)" }} />
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
              <div className="mt-2.5 h-4 w-3/4 animate-pulse rounded" style={{ background: "var(--placeholder, #E6DFCE)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
