import Link from "next/link"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE, type ApercuAgeBucket } from "./apercuTheme"

interface ApercuFilmsListProps {
  items: (ApercuCardMedia & { releaseDate: string | null })[]
  total: number
  page: number
  totalPages: number
  sortKey: string
  sortOptions: { key: string; label: string }[]
  activeAgeKey: string | null
  ageBuckets: ApercuAgeBucket[]
  serifClass: string
}

function buildHref(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `/apercufilmslist?${qs}` : "/apercufilmslist"
}

export function ApercuFilmsList({
  items,
  total,
  page,
  totalPages,
  sortKey,
  sortOptions,
  activeAgeKey,
  ageBuckets,
  serifClass,
}: ApercuFilmsListProps) {
  const p = APERCU_PALETTE
  const activeBucket = ageBuckets.find((b) => b.key === activeAgeKey) ?? null

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden min-h-screen"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuPreviewBanner />
        <ApercuNav />

        {/* Hero band — bg cream */}
        <section
          className="py-8 md:py-12"
          style={{
            background: p.bg,
            borderBottom: `1px solid ${p.line}`,
          }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Catalogue
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              Tous les{" "}
              <em className="italic" style={{ color: p.accent }}>
                films
              </em>
              {activeBucket && (
                <>
                  {" "}
                  <span style={{ color: p.ink2 }}>·</span>{" "}
                  <em className="italic" style={{ color: p.accent2 }}>
                    {activeBucket.name}
                  </em>
                </>
              )}
            </h1>
            <p
              className="mt-3 text-sm md:text-base"
              style={{ color: p.ink2 }}
            >
              {total.toLocaleString("fr-FR")} films analysés{" "}
              {activeBucket
                ? `pour les ${activeBucket.label} ans`
                : "pour votre foyer"}
              . Page {page} sur {totalPages || 1}.
            </p>
          </div>
        </section>

        {/* Filter strip — bg2 darker cream */}
        <section
          className="py-5 md:py-6"
          style={{
            background: p.bg2,
            borderBottom: `1px solid ${p.line}`,
          }}
        >
          <div className="container mx-auto px-4 md:px-8 space-y-4">
            {/* Age tiles strip */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wide mr-1"
                style={{ color: p.ink2 }}
              >
                Âge
              </span>
              <Link
                href={buildHref({ sort: sortKey === "releaseDate" ? undefined : sortKey })}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: activeAgeKey === null ? p.ink : p.card,
                  color: activeAgeKey === null ? p.bg : p.ink,
                  border: `1px solid ${activeAgeKey === null ? p.ink : p.line2}`,
                }}
              >
                Tous
              </Link>
              {ageBuckets.map((b) => {
                const active = activeAgeKey === b.key
                return (
                  <Link
                    key={b.key}
                    href={buildHref({
                      age: b.key,
                      sort: sortKey === "releaseDate" ? undefined : sortKey,
                    })}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: active ? p.ink : p.card,
                      color: active ? p.bg : p.ink,
                      border: `1px solid ${active ? p.ink : p.line2}`,
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: b.color }}
                    />
                    {b.label} ans
                  </Link>
                )
              })}
            </div>

            {/* Sort strip */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wide mr-1"
                style={{ color: p.ink2 }}
              >
                Trier
              </span>
              {sortOptions.map((s) => {
                const active = sortKey === s.key
                return (
                  <Link
                    key={s.key}
                    href={buildHref({
                      age: activeAgeKey ?? undefined,
                      sort: s.key === "releaseDate" ? undefined : s.key,
                    })}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: active ? p.accent : p.card,
                      color: active ? "#fff" : p.ink,
                      border: `1px solid ${active ? p.accent : p.line2}`,
                    }}
                  >
                    {s.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Grid — bg cream */}
        <section className="py-10 md:py-14" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            {items.length === 0 ? (
              <EmptyState serifClass={serifClass} />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                  {items.map((item) => (
                    <ApercuMediaCard
                      key={item.id}
                      media={item}
                      size="sm"
                      serifClass={serifClass}
                    />
                  ))}
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  ageKey={activeAgeKey}
                  sortKey={sortKey}
                  serifClass={serifClass}
                />
              </>
            )}
          </div>
        </section>

        <ApercuFooter serifClass={serifClass} />
      </div>
    </FamilyFitProvider>
  )
}

function EmptyState({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl p-12 text-center"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        color: p.ink2,
      }}
    >
      <div
        className={`${serifClass} text-2xl font-medium mb-2`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Aucun film à afficher
      </div>
      <p className="text-sm">
        Essayez d’élargir la tranche d’âge ou de remettre à zéro les filtres.
      </p>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  ageKey,
  sortKey,
  serifClass,
}: {
  page: number
  totalPages: number
  ageKey: string | null
  sortKey: string
  serifClass: string
}) {
  const p = APERCU_PALETTE
  if (totalPages <= 1) return null

  const prev = page > 1 ? page - 1 : null
  const next = page < totalPages ? page + 1 : null

  return (
    <div
      className="mt-10 pt-6 flex items-center justify-between"
      style={{ borderTop: `1px solid ${p.line}` }}
    >
      <div className="text-sm" style={{ color: p.ink2 }}>
        Page{" "}
        <span className={`${serifClass} font-medium`} style={{ color: p.ink }}>
          {page}
        </span>{" "}
        sur {totalPages}
      </div>
      <div className="flex gap-2">
        <PageLink
          href={
            prev
              ? `/apercufilmslist?${new URLSearchParams({
                  ...(ageKey ? { age: ageKey } : {}),
                  ...(sortKey !== "releaseDate" ? { sort: sortKey } : {}),
                  page: String(prev),
                }).toString()}`
              : null
          }
          label="← Précédent"
        />
        <PageLink
          href={
            next
              ? `/apercufilmslist?${new URLSearchParams({
                  ...(ageKey ? { age: ageKey } : {}),
                  ...(sortKey !== "releaseDate" ? { sort: sortKey } : {}),
                  page: String(next),
                }).toString()}`
              : null
          }
          label="Suivant →"
        />
      </div>
    </div>
  )
}

function PageLink({ href, label }: { href: string | null; label: string }) {
  const p = APERCU_PALETTE
  if (!href) {
    return (
      <span
        className="px-4 py-2 rounded-full text-sm font-medium opacity-40 cursor-not-allowed"
        style={{
          background: p.card,
          color: p.ink2,
          border: `1px solid ${p.line2}`,
        }}
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5"
      style={{
        background: p.card,
        color: p.ink,
        border: `1px solid ${p.line2}`,
      }}
    >
      {label}
    </Link>
  )
}
