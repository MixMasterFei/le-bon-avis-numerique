"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import type { ApercuFilmsListProps } from "@/components/home-v2/ApercuFilmsList"
import { v2FontVars } from "../fonts"
import { Em } from "../parts"
import { RedesignCard, type RedesignCardMedia } from "../RedesignCard"
import { AdminVariantToggle } from "../AdminVariantToggle"
import { CatalogueSidebar } from "./CatalogueSidebar"
import { CataloguePager } from "./CataloguePager"
import type { CatalogueMediaType } from "./useCatalogueFilters"

/**
 * Admin-only V2 catalogue view — the claude-design `.cat-head` + `.filters` +
 * `.cat-grid` + `.pager` rebuilt on the homepage-V2 design system (scoped
 * tokens + fonts, totem cards, the "POUR" family meter). Renders from the
 * exact same server-computed props as ApercuFilmsList (zero new data wiring);
 * the page picks this branch only for admins (and `?v=classic` falls back).
 */
export type CatalogueRedesignProps = ApercuFilmsListProps & {
  /** Route's real default sort (films/séries: releaseDate, jeux: popularity,
   *  mangas: newest) so "Effacer" resets correctly. */
  defaultSort: string
  defaultMinAge?: number
  defaultMaxAge?: number
  /** Optional row above the grid (e.g. manga demographic pills). */
  aboveGrid?: React.ReactNode
}

export function CatalogueRedesign({
  items,
  total,
  page,
  totalPages,
  familyMembers,
  initialFilters,
  filterQuery,
  route = "/films",
  eyebrow = "Catalogue",
  titlePrefix = "Tous les",
  titleAccent = "films",
  itemNoun = { singular: "film", plural: "films" },
  emptyTitle = "Aucun film à afficher",
  mediaType = "MOVIE",
  notice,
  defaultSort,
  defaultMinAge = 2,
  defaultMaxAge = 18,
  aboveGrid,
}: CatalogueRedesignProps) {
  const countNoun = total === 1 ? itemNoun.singular : itemNoun.plural

  // Toggle should return to classic on the same page + filters.
  const toggleQuery = (() => {
    const sp = new URLSearchParams(filterQuery)
    if (page > 1) sp.set("page", String(page))
    return sp.toString()
  })()

  return (
    <FamilyFitProvider>
      <div
        data-home="v2"
        className={`${v2FontVars} flex flex-col overflow-x-hidden`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        {/* cat-head */}
        <section className="border-b py-8 md:py-12" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
            <div className="flex items-center gap-2.5 text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terra)" }} />
              {eyebrow}
            </div>
            <h1
              className="mt-2.5 text-[clamp(30px,4vw,52px)] font-bold leading-[1.03]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              {titlePrefix} <Em tone="terra">{titleAccent}</Em>
            </h1>
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-2)" }}>
              <b style={{ color: "var(--ink)" }}>{total.toLocaleString("fr-FR")}</b> {countNoun} analysés.
              {totalPages > 1 && ` Page ${page} sur ${totalPages}.`}
            </p>
          </div>
        </section>

        {/* cat-body */}
        <section className="py-8 md:py-12" style={{ background: "var(--paper-2)" }}>
          <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
            {aboveGrid && <div className="mb-6">{aboveGrid}</div>}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[262px_1fr] lg:gap-8">
              <CatalogueSidebar
                route={route}
                mediaType={mediaType as CatalogueMediaType}
                familyMembers={familyMembers}
                initialFilters={initialFilters}
                defaultSort={defaultSort}
                defaultMinAge={defaultMinAge}
                defaultMaxAge={defaultMaxAge}
              />

              <div>
                {notice && (
                  <div className="mb-4 rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                    {notice}
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="rounded-[var(--r-lg)] p-12 text-center" style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                    <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)", letterSpacing: "-0.02em" }}>
                      {emptyTitle}
                    </div>
                    <p className="mt-2 text-sm">Essayez d&apos;élargir la tranche d&apos;âge ou de remettre à zéro les filtres.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-[30px] md:grid-cols-3 xl:grid-cols-4">
                      {items.map((item) => (
                        <RedesignCard
                          key={item.id}
                          media={item as RedesignCardMedia}
                          totem="compact"
                          familyVariant="meter"
                        />
                      ))}
                    </div>
                    <CataloguePager page={page} totalPages={totalPages} filterQuery={filterQuery} route={route} />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <AdminVariantToggle variant="v2" route={route} currentQuery={toggleQuery} />
      </div>
    </FamilyFitProvider>
  )
}
