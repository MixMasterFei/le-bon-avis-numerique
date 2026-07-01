import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { fetchMangas } from "@/lib/media-queries"
import { auth, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"
import { MangaDemographicPills } from "@/components/mangas/MangaDemographicPills"

// /mangas is already admin-only (notFound for non-admin), so V2 is the default
// for admins; ?v=classic flips back. Code-split like the other catalogue routes.
const CatalogueRedesign = dynamic(() =>
  import("@/components/home-redesign/catalogue/CatalogueRedesign").then(
    (m) => m.CatalogueRedesign,
  ),
)

export const revalidate = 300

const DEFAULT_MAX_AGE = 18
const PAGE_SIZE = 24
const VALID_DEMOGRAPHICS = ["shounen", "shoujo", "seinen", "josei"] as const

interface MangasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function get(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key]
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

function parseInt2(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw)
  return Number.isFinite(n) ? n : fallback
}

function parseSort(raw: string | undefined): string {
  return raw === "title" || raw === "popularity" || raw === "quality" ? raw : "newest"
}

function parseDemographic(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  return (VALID_DEMOGRAPHICS as readonly string[]).includes(lower) ? lower : undefined
}

export async function generateMetadata({
  searchParams,
}: MangasPageProps): Promise<Metadata> {
  const params = await searchParams
  const demographic = parseDemographic(get(params, "demographic"))
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1

  let title = "Mangas — Trouvez le bon manga pour votre ado"
  let description =
    "Les meilleurs mangas pour la famille : âge recommandé, violence, thèmes, tome par tome. Shounen, shoujo, seinen, josei — indépendant et sans recommandation opaque."

  if (demographic) {
    const label = demographic[0].toUpperCase() + demographic.slice(1)
    title = `Mangas ${label} — Recommandations par âge pour la famille`
    description = `Sélection de mangas ${label} avec âges recommandés, analyse de contenu et avis familiaux.`
  } else if (maxAge && maxAge <= 12) {
    title = `Mangas pour les ${maxAge} ans et moins — Totem Avisé`
    description = `Mangas adaptés aux enfants de ${maxAge} ans et moins.`
  }

  if (page > 1) title += ` — Page ${page}`

  return {
    title,
    description,
    alternates: { canonical: demographic ? `/mangas?demographic=${demographic}` : "/mangas" },
    openGraph: {
      title: `${title} | Totem Avisé`,
      description,
      images: [{ url: "/api/og", width: 1200, height: 630, alt: "Totem Avisé" }],
    },
  }
}

export default async function MangasPage({ searchParams }: MangasPageProps) {
  // Admin-only for now. Manga catalog has non-French synopses on
  // imports + partial French-market coverage; public launch waits
  // until enrichment catches up and coverage is good.
  if (!(await isAdmin())) {
    notFound()
  }

  const params = await searchParams
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  // Admin is guaranteed here (notFound above); V2 is the default, ?v=classic flips back.
  const showV2 = get(params, "v") !== "classic"

  const page = Math.max(1, parseInt2(get(params, "page"), 1))
  const search = (get(params, "q") ?? "").trim()
  const sortKey = parseSort(get(params, "sort") || get(params, "sortBy"))
  const demographic = parseDemographic(get(params, "demographic"))
  const topics = parseList(get(params, "topics"))

  const familyMembers = userId
    ? await prisma.familyMember.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          birthYear: true,
          birthMonth: true,
          avatarEmoji: true,
          avatarStyle: true,
          avatarSeed: true,
          avatarOptions: true,
        },
      })
    : []

  // Mangas use demographic pills (shounen/shoujo/seinen/josei) as the
  // primary discovery lens instead of the 2-18 age slider used for
  // films/TV/games. Demographic already implies an age band and is the
  // canonical way manga is organized in French bookstores — layering an
  // age filter on top of that is redundant complexity. Age cap is still
  // available via URL param for power users.
  const explicitMaxAge = get(params, "maxAge") ? parseInt2(get(params, "maxAge"), DEFAULT_MAX_AGE) : undefined

  const result = await fetchMangas({
    page,
    limit: PAGE_SIZE,
    maxAge: explicitMaxAge,
    topics: topics.length > 0 ? topics : undefined,
    search: search || undefined,
    sortBy: sortKey !== "newest" ? sortKey : undefined,
    demographic,
    requirePoster: true,
  })

  const items = result.items.map((m) => {
    const cm = m.contentMetrics as
      | {
          violence?: number | null
          sexNudity?: number | null
          language?: number | null
          substanceUse?: number | null
        }
      | null
    return {
      id: m.id,
      // ApercuMediaCard only knows MOVIE|TV|GAME, but MANGA renders the
      // same shape (poster + age + genres) — cast so it treats manga
      // like a generic poster tile. Detail-page routing uses the
      // real type from the DB.
      type: "MOVIE" as const,
      title: m.title,
      posterUrl: m.posterUrl ?? null,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres,
      releaseDate: m.releaseDate,
      contentMetrics: cm
        ? {
            violence: cm.violence ?? null,
            sexNudity: cm.sexNudity ?? null,
            language: cm.language ?? null,
            substanceUse: cm.substanceUse ?? null,
          }
        : null,
    }
  })

  const filterSp = new URLSearchParams()
  if (search) filterSp.set("q", search)
  if (sortKey !== "newest") filterSp.set("sort", sortKey)
  if (demographic) filterSp.set("demographic", demographic)
  if (explicitMaxAge && explicitMaxAge < DEFAULT_MAX_AGE) filterSp.set("maxAge", String(explicitMaxAge))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  const variant = get(params, "v")
  if (variant) filterSp.set("v", variant)

  const baseUrl = "https://totemavise.com"
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Mangas", item: `${baseUrl}/mangas` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {(() => {
        const listProps = {
          items,
          total: result.pagination.total,
          page,
          totalPages: result.pagination.totalPages,
          serifClass: "font-serif",
          familyMembers: familyMembers.map((m) => ({
            id: m.id,
            name: m.name,
            birthYear: m.birthYear,
            birthMonth: m.birthMonth,
            avatarEmoji: m.avatarEmoji,
            avatarStyle: m.avatarStyle,
            avatarSeed: m.avatarSeed,
            avatarOptions: m.avatarOptions as Record<string, unknown> | null,
          })),
          initialFilters: {
            search,
            sort: sortKey,
            // No default age range for mangas — demographic pills are the
            // primary filter. Pass 0/99 so the sidebar doesn't preset a
            // "2-18" constraint that would confuse demographic-based browsing.
            minAge: 0,
            maxAge: explicitMaxAge ?? 99,
            platforms: [],
            topics,
            familyMemberIds: [],
          },
          filterQuery: filterSp.toString(),
          route: "/mangas",
          eyebrow: "Catalogue manga",
          titlePrefix: "Tous les",
          titleAccent: "mangas",
          itemNoun: { singular: "manga", plural: "mangas" },
          emptyTitle: "Aucun manga à afficher",
          mediaType: "MANGA" as const,
        }
        return showV2 ? (
          <CatalogueRedesign
            {...listProps}
            defaultSort="newest"
            defaultMinAge={0}
            defaultMaxAge={99}
            aboveGrid={
              <MangaDemographicPills
                active={demographic}
                baseQuery={filterSp.toString()}
                variant="v2"
              />
            }
          />
        ) : (
          <>
            {/* Demographic pill row sits above the shared films list layout. */}
            <MangaDemographicPills active={demographic} baseQuery={filterSp.toString()} />
            <ApercuFilmsList {...listProps} />
          </>
        )
      })()}
    </>
  )
}
