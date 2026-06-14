import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { fetchGames } from "@/lib/media-queries"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"
import { runSmartFilter } from "@/lib/smart-filter"

// Admin-only V2 catalogue, code-split so its chunk + fonts stay out of the
// public bundle. Classic /jeux is unchanged for anon/non-admin.
const CatalogueRedesign = dynamic(() =>
  import("@/components/home-redesign/catalogue/CatalogueRedesign").then(
    (m) => m.CatalogueRedesign,
  ),
)

export const revalidate = 300

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18
const PAGE_SIZE = 24

interface GamesPageProps {
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

function parseGameSort(raw: string | undefined): string {
  // "newest" is an alias for "releaseDate" so both /jeux?sort=newest
  // (matching the homepage "Voir tout" convention used elsewhere) and
  // /jeux?sort=releaseDate (matching fetchGames' sortBy values) work.
  if (raw === "quality" || raw === "title" || raw === "releaseDate") return raw
  if (raw === "newest") return "releaseDate"
  return "popularity"
}

export async function generateMetadata({
  searchParams,
}: GamesPageProps): Promise<Metadata> {
  const params = await searchParams
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1
  const q = get(params, "q")
  const hasFilters = !!(
    get(params, "topics") ||
    get(params, "platforms") ||
    get(params, "minAge") ||
    maxAge ||
    q
  )

  let title = "Jeux Vidéo — Avis PEGI et âges recommandés"
  // Lengthened from 116 to 154 chars (target 120+) — gives Google
  // more topic signal and matches the actual filter set on this page.
  let description =
    "Jeux vidéo adaptés à chaque âge : analyses PEGI, microtransactions, contenu en ligne, modes de jeu, plateformes (Switch, PlayStation, Xbox) et recommandations parentales."

  if (q) {
    title = `Recherche « ${q} » — Jeux vidéo pour la famille`
  } else if (maxAge && maxAge <= 7) {
    title = "Jeux vidéo pour les enfants — Avis PEGI et âges recommandés"
    description = `Jeux vidéo adaptés aux enfants de ${maxAge} ans et moins.`
  } else if (maxAge) {
    title = `Jeux vidéo pour les ${maxAge} ans et moins`
  }

  if (page > 1) {
    title += ` — Page ${page}`
  }

  let canonical = "/jeux"
  if (!hasFilters && page > 1) {
    canonical = `/jeux?page=${page}`
  }

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Totem Avisé`,
      description,
      images: [
        { url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" },
      ],
    },
  }
}

export default async function JeuxPage({ searchParams }: GamesPageProps) {
  const params = await searchParams
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN"
  const showV2 = isAdmin && get(params, "v") !== "classic"

  const page = Math.max(1, parseInt2(get(params, "page"), 1))
  const search = (get(params, "q") ?? "").trim()
  const sortKey = parseGameSort(get(params, "sort") || get(params, "sortBy"))
  const memberIds = parseList(get(params, "members"))
  const platforms = parseList(get(params, "platforms"))
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

  let effectiveMinAge = parseInt2(get(params, "minAge"), DEFAULT_MIN_AGE)
  let effectiveMaxAge = parseInt2(get(params, "maxAge"), DEFAULT_MAX_AGE)

  if (memberIds.length > 0) {
    const selectedAges = memberIds
      .map((id) => familyMembers.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => getMemberAge(m.birthYear, m.birthMonth))
      .filter((a): a is number => a !== null)
    if (selectedAges.length > 0) {
      const youngest = Math.min(...selectedAges)
      if (!get(params, "maxAge")) {
        effectiveMaxAge = Math.min(DEFAULT_MAX_AGE, youngest)
      }
      if (!get(params, "minAge")) {
        effectiveMinAge = Math.max(DEFAULT_MIN_AGE, youngest - 3)
      }
    }
  }

  // Soft personalization: a selected member re-ORDERS by family fit (nothing
  // hidden — strictMode=false, minScore=0). /jeux defaults to popularity sort;
  // any explicit sort keeps the DB order. See src/lib/smart-filter.ts.
  const useSmartRerank =
    !!userId && memberIds.length > 0 && sortKey === "popularity"

  const smart = useSmartRerank
    ? await runSmartFilter({
        userId: userId!,
        familyMemberIds: memberIds,
        mediaType: "GAME",
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        strictMode: false,
        minScore: 0,
        platforms: platforms.length > 0 ? platforms : undefined,
        topics: topics.length > 0 ? topics : undefined,
        search: search || undefined,
        minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
        maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
      })
    : null

  const result = useSmartRerank
    ? null
    : await fetchGames({
        page,
        limit: PAGE_SIZE,
        minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
        // <= (not <) — see films/page.tsx note: keeps the homepage "16+"
        // age tile from being silently a no-op when maxAge equals the default cap.
        maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        topics: topics.length > 0 ? topics : undefined,
        search: search || undefined,
        sortBy: sortKey,
        requirePoster: true,
        // Recency-sorted browse only surfaces games with enough IGDB
        // signal to be considered mainstream — keeps obscure shovelware
        // out of "Récents". Popularity / quality / A→Z sorts naturally
        // sink unknowns to the bottom so they don't need this floor.
        minVoteCount: sortKey === "releaseDate" ? 20 : undefined,
      })

  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  const dbItems = (result?.items ?? []).map((m) => {
    const cm = m.contentMetrics as
      | {
          violence?: number | null
          sexNudity?: number | null
          language?: number | null
          substanceUse?: number | null
          consumerism?: number | null
        }
      | null
    return {
      id: m.id,
      type: m.type as "MOVIE" | "TV" | "GAME",
      title: m.title,
      posterUrl: m.posterUrl ?? null,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres,
      releaseDate: m.releaseDate,
      // Games show Violence + Achats intégrés (consumerism) in the totem,
      // so consumerism must ride along (films/TV ignore it).
      contentMetrics: cm
        ? {
            violence: cm.violence ?? null,
            sexNudity: cm.sexNudity ?? null,
            language: cm.language ?? null,
            substanceUse: cm.substanceUse ?? null,
            consumerism: cm.consumerism ?? null,
          }
        : null,
    }
  })
  const smartItems = (smart?.results ?? []).map((m) => ({
    id: m.mediaId,
    type: m.type as "MOVIE" | "TV" | "GAME",
    title: m.title,
    posterUrl: m.posterUrl ?? null,
    expertAgeRec: m.expertAgeRec,
    genres: m.genres,
    releaseDate: m.releaseDate ? m.releaseDate.toISOString().split("T")[0] : null,
    contentMetrics: m.contentMetrics
      ? {
          violence: num(m.contentMetrics.violence),
          sexNudity: num(m.contentMetrics.sexNudity),
          language: num(m.contentMetrics.language),
          substanceUse: num(m.contentMetrics.substanceUse),
          consumerism: num(
            (m.contentMetrics as { consumerism?: number | null }).consumerism,
          ),
        }
      : null,
  }))
  const items = useSmartRerank ? smartItems : dbItems
  const totalItems = useSmartRerank ? smart?.total ?? 0 : result?.pagination.total ?? 0
  const totalPages = useSmartRerank
    ? Math.max(1, Math.ceil((smart?.total ?? 0) / PAGE_SIZE))
    : result?.pagination.totalPages ?? 1

  const filterSp = new URLSearchParams()
  if (search) filterSp.set("q", search)
  if (sortKey !== "popularity") filterSp.set("sort", sortKey)
  if (effectiveMinAge > DEFAULT_MIN_AGE)
    filterSp.set("minAge", String(effectiveMinAge))
  if (effectiveMaxAge < DEFAULT_MAX_AGE)
    filterSp.set("maxAge", String(effectiveMaxAge))
  if (platforms.length > 0) filterSp.set("platforms", platforms.join(","))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  if (memberIds.length > 0) filterSp.set("members", memberIds.join(","))
  const variant = get(params, "v")
  if (variant) filterSp.set("v", variant)

  const baseUrl = "https://totemavise.com"
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Jeux vidéo",
        item: `${baseUrl}/jeux`,
      },
    ],
  }

  const itemListLd = items.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Jeux vidéo pour la famille",
        numberOfItems: totalItems,
        itemListElement: items.slice(0, 20).map((item, idx) => ({
          "@type": "ListItem",
          position: (page - 1) * PAGE_SIZE + idx + 1,
          url: `${baseUrl}/media/${encodeURIComponent(item.id)}`,
          name: item.title,
        })),
      }
    : null

  const notice =
    useSmartRerank && smart?.capped
      ? "Vue personnalisée limitée aux titres les plus pertinents — affinez les filtres pour en voir plus."
      : undefined

  return (
    <>
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
      {(() => {
        const listProps = {
          items,
          total: totalItems,
          page,
          totalPages,
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
            minAge: effectiveMinAge,
            maxAge: effectiveMaxAge,
            platforms,
            topics,
            familyMemberIds: memberIds,
          },
          filterQuery: filterSp.toString(),
          route: "/jeux",
          notice,
          eyebrow: "Catalogue",
          titlePrefix: "Tous les",
          titleAccent: "jeux vidéo",
          itemNoun: { singular: "jeu", plural: "jeux" },
          emptyTitle: "Aucun jeu à afficher",
          mediaType: "GAME" as const,
        }
        return showV2 ? (
          <CatalogueRedesign {...listProps} defaultSort="popularity" />
        ) : (
          <ApercuFilmsList {...listProps} />
        )
      })()}
    </>
  )
}
