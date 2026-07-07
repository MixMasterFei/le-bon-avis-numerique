import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { toMediaRouteId } from "@/lib/media-route"
import { ageBandCatalogWhere } from "@/lib/age-bands"
import type { Prisma } from "@prisma/client"
import {
  ApercuMediaCard,
  type ApercuCardMedia,
} from "@/components/home-v2/ApercuMediaCard"
import { RedesignCard } from "@/components/home-redesign/RedesignCard"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { isAdmin as checkIsAdmin } from "@/lib/auth"
import { v2Enabled } from "@/lib/v2-flag"

export const revalidate = 1800

const ITEMS_PER_PAGE = 24

const ageRanges: Record<
  string,
  { min: number; max: number; label: string; description: string }
> = {
  "2-4": {
    min: 2,
    max: 4,
    label: "2-4 ans",
    description: "Contenu adapté aux tout-petits avec des histoires simples et colorées.",
  },
  "5-7": {
    min: 5,
    max: 7,
    label: "5-7 ans",
    description: "Aventures pour les jeunes enfants avec des thèmes d'amitié et de découverte.",
  },
  "8-10": {
    min: 8,
    max: 10,
    label: "8-10 ans",
    description: "Histoires plus complexes avec des héros attachants et des défis à surmonter.",
  },
  "11-12": {
    min: 11,
    max: 12,
    label: "11-12 ans",
    description: "Contenu pour les pré-adolescents avec des thèmes plus matures et nuancés.",
  },
  "13-15": {
    min: 13,
    max: 15,
    label: "13-15 ans",
    description: "Contenu pour adolescents abordant des sujets complexes adaptés à leur âge.",
  },
  "16-plus": {
    min: 16,
    max: 18,
    label: "16+ ans",
    description: "Contenu pour grands adolescents et jeunes adultes.",
  },
}

interface AgePageProps {
  params: Promise<{ range: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function fetchAgeRangeMedia(min: number, max: number, page: number) {
  // Shared with /api/stats/age-bands so the homepage "Par âge" counts always
  // match what this page lists — films, séries and games only (mangas/books
  // have their own sections). See src/lib/age-bands.ts.
  const where: Prisma.MediaItemWhereInput = ageBandCatalogWhere(min, max)

  // The 8+ bands are game-heavy in the catalog, which made these pages read as
  // a games-only list (films/séries buried). Pull a quality-ordered pool, then
  // round-robin interleave by media type so every page shows a film/série/jeu
  // mix. We paginate over the interleaved pool (bounded — plenty for a browse
  // surface).
  const POOL_SIZE = 240

  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where,
      orderBy: [{ tmdbRating: { sort: "desc", nulls: "last" } }],
      take: POOL_SIZE,
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        expertAgeRec: true,
        genres: true,
        contentMetrics: {
          select: {
            violence: true,
            sexNudity: true,
            language: true,
            substanceUse: true,
          },
        },
      },
    }),
  )

  // Round-robin: MOVIE[i], TV[i], GAME[i], … — keeps each type's quality order
  // while guaranteeing a mix; a band with only one type just falls back to it.
  const buckets: Record<string, typeof pool> = { MOVIE: [], TV: [], GAME: [] }
  for (const it of pool) (buckets[it.type] ??= []).push(it)
  const TYPE_ORDER = ["MOVIE", "TV", "GAME"] as const
  const interleaved: typeof pool = []
  for (let i = 0; interleaved.length < pool.length; i++) {
    let progressed = false
    for (const t of TYPE_ORDER) {
      const b = buckets[t]
      if (b && b[i]) {
        interleaved.push(b[i])
        progressed = true
      }
    }
    if (!progressed) break
  }

  const total = interleaved.length
  const pageStart = (page - 1) * ITEMS_PER_PAGE
  const rawItems = interleaved.slice(pageStart, pageStart + ITEMS_PER_PAGE)

  const items: ApercuCardMedia[] = rawItems.map((item) => ({
    id: item.id,
    type: item.type as "MOVIE" | "TV" | "GAME",
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec,
    genres: item.genres || [],
    contentMetrics: item.contentMetrics
      ? {
          violence: item.contentMetrics.violence,
          sexNudity: item.contentMetrics.sexNudity,
          language: item.contentMetrics.language,
          substanceUse: item.contentMetrics.substanceUse,
        }
      : null,
  }))

  return { items, rawItems, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) }
}

export default async function AgePage({
  params,
  searchParams,
}: AgePageProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const { range } = await params
  const sp = await searchParams
  const ageRange = ageRanges[range]

  if (!ageRange) {
    notFound()
  }

  const pageParam =
    typeof sp.page === "string"
      ? sp.page
      : Array.isArray(sp.page)
        ? sp.page[0]
        : "1"
  const currentPage = Math.max(1, parseInt(pageParam || "1") || 1)

  const { items, rawItems, total, totalPages } = await fetchAgeRangeMedia(
    ageRange.min,
    ageRange.max,
    currentPage
  )

  // Use the V2 card (bars + augmented totem-with-hover + monogram avatars) when
  // V2 is on, so the age pages match the rest of the site instead of the legacy
  // apercu card (hearts + plain badge). Follows the master flag → rollback-safe.
  const v2Cards = v2Enabled(await checkIsAdmin())

  const baseUrl = "https://totemavise.com"

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: `Contenus ${ageRange.label}`,
        item: `${baseUrl}/age/${range}`,
      },
    ],
  }

  const itemListLd =
    rawItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Contenus pour les ${ageRange.label}`,
          description: ageRange.description,
          numberOfItems: total,
          itemListElement: rawItems.slice(0, 20).map((item, idx) => ({
            "@type": "ListItem",
            position: (currentPage - 1) * ITEMS_PER_PAGE + idx + 1,
            url: `${baseUrl}/media/${toMediaRouteId(
              item.type as "MOVIE" | "TV" | "GAME",
              item.id
            )}`,
            name: item.title,
          })),
        }
      : null

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col flex-1"
        style={{ background: p.bg, color: p.ink }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
          />
        )}

        <section
          className="py-8 md:py-12"
          style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm hover:opacity-70 mb-5"
              style={{ color: p.ink2 }}
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l&apos;accueil
            </Link>

            <div className="flex items-center gap-4 mb-5">
              <div
                className="p-3 rounded-2xl"
                style={{ background: p.bg2, color: p.accent }}
              >
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: p.accent }}
                >
                  Par âge
                </div>
                <h1
                  className={`${serifClass} text-3xl md:text-4xl font-medium m-0 leading-[1.05]`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Contenu pour les{" "}
                  <em className="italic" style={{ color: p.accent }}>
                    {ageRange.label}
                  </em>
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm md:text-base" style={{ color: p.ink2 }}>
              {ageRange.description}
            </p>

            <div
              className="mt-6 max-w-3xl rounded-2xl p-4"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: p.accent }}
              >
                Réponse rapide
              </p>
              <h2
                className={`${serifClass} text-lg md:text-xl font-medium mb-2`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Quels contenus choisir pour les {ageRange.label} ?
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: p.ink2 }}>
                Pour les {ageRange.label}, privilégiez des contenus dont l&apos;âge
                recommandé reste dans cette tranche et vérifiez les signaux
                sensibles comme la violence, la peur, le langage ou les thèmes
                adultes. Les cartes ci-dessous combinent âge recommandé,
                qualité des données et repères de contenu pour aider les parents
                à décider plus vite.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              {Object.entries(ageRanges).map(([key, value]) => {
                const active = key === range
                return (
                  <Link
                    key={key}
                    href={`/age/${key}`}
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                    style={{
                      background: active ? p.ink : p.card,
                      color: active ? p.bg : p.ink,
                      border: `1px solid ${active ? p.ink : p.line}`,
                    }}
                  >
                    {value.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section
          className="flex-1 py-8 md:py-12"
          style={{ background: p.bg2 }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm" style={{ color: p.ink2 }}>
                {total} résultat{total !== 1 ? "s" : ""} pour cette tranche
                d&apos;âge
              </p>
              {totalPages > 1 && (
                <p className="text-sm" style={{ color: p.ink2 }}>
                  Page {currentPage} sur {totalPages}
                </p>
              )}
            </div>

            {items.length > 0 ? (
              <>
                {v2Cards ? (
                  <div
                    data-home="v2"
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5"
                  >
                    {items.map((item) => (
                      <RedesignCard key={item.id} media={item} totem="compact" showType />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                    {items.map((item) => (
                      <ApercuMediaCard
                        key={item.id}
                        media={item}
                        size="sm"
                        serifClass={serifClass}
                      />
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <nav
                    className="mt-10 pt-6 flex items-center justify-between"
                    style={{ borderTop: `1px solid ${p.line2}` }}
                    aria-label="Pagination"
                  >
                    <div className="text-sm" style={{ color: p.ink2 }}>
                      Page{" "}
                      <span
                        className={`${serifClass} font-medium`}
                        style={{ color: p.ink }}
                      >
                        {currentPage}
                      </span>{" "}
                      sur {totalPages}
                    </div>
                    <div className="flex gap-2">
                      {currentPage > 1 ? (
                        <Link
                          href={`/age/${range}${currentPage - 1 > 1 ? `?page=${currentPage - 1}` : ""}`}
                          rel="prev"
                          className="px-4 py-2 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5"
                          style={{
                            background: p.card,
                            color: p.ink,
                            border: `1px solid ${p.line2}`,
                          }}
                        >
                          ← Précédent
                        </Link>
                      ) : (
                        <span
                          className="px-4 py-2 rounded-full text-sm font-medium opacity-40 cursor-not-allowed"
                          style={{
                            background: p.card,
                            color: p.ink2,
                            border: `1px solid ${p.line2}`,
                          }}
                        >
                          ← Précédent
                        </span>
                      )}
                      {currentPage < totalPages ? (
                        <Link
                          href={`/age/${range}?page=${currentPage + 1}`}
                          rel="next"
                          className="px-4 py-2 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5"
                          style={{
                            background: p.card,
                            color: p.ink,
                            border: `1px solid ${p.line2}`,
                          }}
                        >
                          Suivant →
                        </Link>
                      ) : (
                        <span
                          className="px-4 py-2 rounded-full text-sm font-medium opacity-40 cursor-not-allowed"
                          style={{
                            background: p.card,
                            color: p.ink2,
                            border: `1px solid ${p.line2}`,
                          }}
                        >
                          Suivant →
                        </span>
                      )}
                    </div>
                  </nav>
                )}
              </>
            ) : (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <Users
                  className="h-12 w-12 mx-auto mb-4"
                  style={{ color: p.ink2, opacity: 0.4 }}
                />
                <h2
                  className={`${serifClass} text-2xl font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Aucun contenu disponible
                </h2>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  Nous n&apos;avons pas encore de contenu pour cette tranche
                  d&apos;âge.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}
