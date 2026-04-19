import Link from "next/link"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { ApercuFilterSidebar } from "./ApercuFilterSidebar"
import { APERCU_PALETTE } from "./apercuTheme"

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string | null
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
}

interface ApercuFilmsListProps {
  items: (ApercuCardMedia & { releaseDate: string | null })[]
  total: number
  page: number
  totalPages: number
  serifClass: string
  familyMembers: FamilyMember[]
  initialFilters: {
    search: string
    sort: string
    minAge: number
    maxAge: number
    platforms: string[]
    topics: string[]
    familyMemberIds: string[]
  }
  /** Search-param string (without `page`) so pagination can build hrefs server-side. */
  filterQuery: string
}

export function ApercuFilmsList({
  items,
  total,
  page,
  totalPages,
  serifClass,
  familyMembers,
  initialFilters,
  filterQuery,
}: ApercuFilmsListProps) {
  const p = APERCU_PALETTE

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
            </h1>
            <p
              className="mt-3 text-sm md:text-base"
              style={{ color: p.ink2 }}
            >
              {total.toLocaleString("fr-FR")} films analysés.
              {totalPages > 1 && ` Page ${page} sur ${totalPages}.`}
            </p>
          </div>
        </section>

        {/* Body: sticky sidebar (1/4) + grid (3/4), bg2 deeper cream */}
        <section className="py-8 md:py-12" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-10 items-start">
              {/* Sticky filter sidebar */}
              <ApercuFilterSidebar
                serifClass={serifClass}
                familyMembers={familyMembers}
                initialFilters={initialFilters}
              />

              {/* Grid */}
              <div>
                {items.length === 0 ? (
                  <EmptyState serifClass={serifClass} />
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
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
                      serifClass={serifClass}
                      filterQuery={filterQuery}
                    />
                  </>
                )}
              </div>
            </div>
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
  serifClass,
  filterQuery,
}: {
  page: number
  totalPages: number
  serifClass: string
  filterQuery: string
}) {
  const p = APERCU_PALETTE
  if (totalPages <= 1) return null

  const buildHref = (target: number) => {
    const sp = new URLSearchParams(filterQuery)
    sp.set("page", String(target))
    return `/apercufilmslist?${sp.toString()}`
  }

  const prevHref = page > 1 ? buildHref(page - 1) : null
  const nextHref = page < totalPages ? buildHref(page + 1) : null

  return (
    <div
      className="mt-10 pt-6 flex items-center justify-between"
      style={{ borderTop: `1px solid ${p.line2}` }}
    >
      <div className="text-sm" style={{ color: p.ink2 }}>
        Page{" "}
        <span className={`${serifClass} font-medium`} style={{ color: p.ink }}>
          {page}
        </span>{" "}
        sur {totalPages}
      </div>
      <div className="flex gap-2">
        <PageLink href={prevHref} label="← Précédent" />
        <PageLink href={nextHref} label="Suivant →" />
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
