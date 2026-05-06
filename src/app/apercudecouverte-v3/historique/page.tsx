import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuNewsCard, type ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces, APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import { Prisma } from "@prisma/client"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 24

interface SearchParams {
  font?: string
  p?: string
}

function toSources(raw: Prisma.JsonValue | null): NewsSourceRef[] {
  if (!Array.isArray(raw)) return []
  // Same publisher-name dedup as the other news-rendering pages —
  // older rows had URL-based dedup, which left multiple pills per
  // publisher when several articles came from the same source.
  const seen = new Set<string>()
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url || seen.has(name)) return []
    seen.add(name)
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
        country: typeof e.country === "string" ? e.country : undefined,
      },
    ]
  })
}

/**
 * Historique de la découverte — paginated archive of every story V3
 * is allowed to surface (BRIEFs in the V3 category/region matrix +
 * all DOSSIERs). Visual layout intentionally mirrors V3's "Plus tôt
 * cette semaine" grid so it reads as a natural continuation of the
 * homepage feed rather than a separate listing.
 */
export default async function HistoriqueV3Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?callbackUrl=/apercudecouverte-v3/historique")
  }
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/apercudecouverte-v3/historique")
  }

  const searchParams = await props.searchParams
  const requestedPage = parseInt(searchParams?.p ?? "1", 10)
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? requestedPage : 1
  const skip = (page - 1) * PAGE_SIZE

  // V3-eligible stories — same multi-clause matrix the homepage uses
  // (FR briefs in 4 categories, INTL briefs in PARENTHOOD only, all
  // TECH briefs, all dossiers). Keeping the rules in sync ensures the
  // historique is exactly the universe a visitor could ever have seen
  // on the V3 homepage, just unrolled chronologically and uncurated.
  const where: Prisma.NewsStoryWhereInput = {
    status: "PUBLISHED",
    OR: [
      {
        storyType: "BRIEF",
        region: "FR",
        category: { in: ["PARENTHOOD", "FILM_TV", "GAMES", "READING"] },
      },
      { storyType: "BRIEF", region: "INTL", category: "PARENTHOOD" },
      { storyType: "BRIEF", category: "TECH" },
      { storyType: "DOSSIER" },
    ],
  }

  // +1 lookahead to detect a next page without an extra count query.
  const rows = await prisma.newsStory.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    skip,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      imageUrl: true,
      imageCredit: true,
      imageLicenseUrl: true,
      category: true,
      publishedAt: true,
      sources: true,
    },
  })

  const hasMore = rows.length > PAGE_SIZE
  const stories: ApercuNewsCardData[] = (hasMore ? rows.slice(0, PAGE_SIZE) : rows)
    .filter((r) => !isBlockedHotlinkImageUrl(r.imageUrl))
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      imageUrl: r.imageUrl,
      imageCredit: r.imageCredit,
      imageLicenseUrl: r.imageLicenseUrl,
      category: r.category,
      publishedAt: r.publishedAt,
      sources: toSources(r.sources),
    }))

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces ? fraunces.className : "font-[var(--font-heading)]"
  const p = APERCU_PALETTE

  const buildHref = (n: number) =>
    n <= 1 ? "/apercudecouverte-v3/historique" : `/apercudecouverte-v3/historique?p=${n}`

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <main style={{ background: p.bg, color: p.ink }}>
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-6xl">
          <div className="mb-8">
            <Link
              href="/apercudecouverte-v3"
              className="text-xs font-medium hover:opacity-70 transition-opacity"
              style={{ color: p.ink2 }}
            >
              ← Retour à la découverte
            </Link>
            <h1
              className={`${serifClass} text-3xl md:text-4xl font-medium mt-3 leading-tight`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              Historique de la découverte
            </h1>
            <p className="mt-2 text-sm md:text-base" style={{ color: p.ink2 }}>
              Toutes les actualités sélectionnées, de la plus récente à la
              plus ancienne.
            </p>
          </div>

          {stories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stories.map((s) => (
                <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
              ))}
            </div>
          ) : (
            <div
              className="text-center py-16 rounded-2xl"
              style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
            >
              <p className="text-sm">Aucune actualité à afficher pour le moment.</p>
            </div>
          )}

          {(page > 1 || hasMore) && (
            <nav
              className="mt-10 flex items-center justify-between gap-3"
              aria-label="Pagination"
            >
              {page > 1 ? (
                <Link
                  href={buildHref(page - 1)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ background: p.card, border: `1px solid ${p.line2}`, color: p.ink }}
                >
                  ← Plus récent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm" style={{ color: p.ink2 }}>
                Page {page}
              </span>
              {hasMore ? (
                <Link
                  href={buildHref(page + 1)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: p.ink, color: p.bg }}
                >
                  Plus ancien →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </main>
    </div>
  )
}
