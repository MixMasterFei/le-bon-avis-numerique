import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { fetchMovies } from "@/lib/media-queries"
import { auth } from "@/lib/auth"
import { v2Enabled } from "@/lib/v2-flag"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"

// Admin-only V2 catalogue. Dynamically imported so its chunk + the 3 V2 fonts
// never ship to anonymous/public visitors (the default classic view is served
// to everyone else).
const CatalogueRedesign = dynamic(() =>
  import("@/components/home-redesign/catalogue/CatalogueRedesign").then(
    (m) => m.CatalogueRedesign,
  ),
)
import { isCinemaSort } from "@/lib/cinema-policy"
import { getCinemaMovies } from "@/lib/cinema"
import { runSmartFilter } from "@/lib/smart-filter"

export const revalidate = 300

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18
const PAGE_SIZE = 24

interface FilmsPageProps {
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
  if (raw === "quality" || raw === "title") return raw
  if (isCinemaSort(raw)) return "cinema"
  return "releaseDate"
}

export async function generateMetadata({
  searchParams,
}: FilmsPageProps): Promise<Metadata> {
  const params = await searchParams
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1
  const q = get(params, "q")
  const isCinema = isCinemaSort(get(params, "sort")) || isCinemaSort(get(params, "sortBy"))
  const hasFilters = !!(
    get(params, "topics") ||
    get(params, "platforms") ||
    get(params, "minAge") ||
    maxAge ||
    q
  )

  let title = "Films — Âge conseillé et avis famille"
  let description =
    "Les meilleurs films pour votre famille : analyses détaillées, violence, langage, messages positifs, et un âge conseillé indépendant affiné par les familles."

  if (isCinema) {
    title = "Films à l'affiche en France — Repères d'âge"
    description =
      "Les films importants actuellement en salle en France, avec les repères Totem Avisé pour savoir lesquels conviennent à votre famille."
  } else if (q) {
    title = `Recherche « ${q} » — Films pour la famille`
  } else if (maxAge && maxAge <= 7) {
    title = "Films pour les enfants — Avis et âges recommandés"
    description = `Films adaptés aux enfants de ${maxAge} ans et moins.`
  } else if (maxAge) {
    title = `Films pour les ${maxAge} ans et moins`
  }

  if (page > 1) {
    title += ` — Page ${page}`
  }

  let canonical = "/films"
  if (!hasFilters && page > 1) {
    canonical = `/films?page=${page}`
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

export default async function FilmsPage({ searchParams }: FilmsPageProps) {
  const params = await searchParams
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN"
  const showV2 = v2Enabled(isAdmin) && get(params, "v") !== "classic"

  const page = Math.max(1, parseInt2(get(params, "page"), 1))
  const search = (get(params, "q") ?? "").trim()
  const sortKey = parseSort(get(params, "sort") || get(params, "sortBy"))
  const isCinema = sortKey === "cinema"
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

  const parseMetric = (key: string): number | undefined => {
    const raw = get(params, key)
    if (!raw) return undefined
    const n = parseInt(raw)
    return Number.isFinite(n) ? n : undefined
  }
  const maxViolence = parseMetric("maxViolence")
  const maxSexual = parseMetric("maxSexual")
  const maxLanguage = parseMetric("maxLanguage")
  const maxSubstance = parseMetric("maxSubstance")
  const maxConsumerism = parseMetric("maxConsumerism")

  // "Derniers ajouts" (sort=newest) is an in-scope surface for provisional films;
  // the default curated browse stays expert-only.
  const includeProvisional = (get(params, "sort") || get(params, "sortBy")) === "newest"

  // Soft personalization: when a member is selected (and the user hasn't picked
  // an explicit sort), re-ORDER the age-appropriate catalogue by family fit.
  // strictMode=false + minScore=0 → nothing is hidden, only re-ranked, so a kid
  // who dislikes horror sees it lower, never gone. Explicit sorts (newest/
  // quality/title) and cinema mode keep the plain DB order.
  const useSmartRerank =
    !!userId && memberIds.length > 0 && !isCinema && sortKey === "releaseDate"

  const smart = useSmartRerank
    ? await runSmartFilter({
        userId: userId!,
        familyMemberIds: memberIds,
        mediaType: "MOVIE",
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        strictMode: false,
        minScore: 0,
        platforms: platforms.length > 0 ? platforms : undefined,
        topics: topics.length > 0 ? topics : undefined,
        search: search || undefined,
        language: "fr,en",
        minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
        maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
      })
    : null

  const result = isCinema || useSmartRerank ? null : await fetchMovies({
    page,
    limit: PAGE_SIZE,
    includeProvisional,
    minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
    // <= (not <) so maxAge=18 from the homepage "16+" age tile is
    // treated as a real filter (expertAgeRec ≤ 18 AND NOT NULL),
    // not silently dropped. Without this, the 16+ tile routes to
    // the same page as the default browse with no visible filter.
    maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    topics: topics.length > 0 ? topics : undefined,
    search: search || undefined,
    sortBy: sortKey !== "releaseDate" && sortKey !== "cinema" ? sortKey : undefined,
    nowPlaying: false,
    requirePoster: true,
    language: "fr,en",
    maxViolence,
    maxSexual,
    maxLanguage,
    maxSubstance,
    maxConsumerism,
  })

  const cinemaMovies = isCinema
    ? await getCinemaMovies({
        minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
        maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
      })
    : []

  const filteredCinemaMovies = isCinema
    ? cinemaMovies.filter((movie) => {
        if (search) {
          const q = search.toLocaleLowerCase("fr-FR")
          const title = movie.title.toLocaleLowerCase("fr-FR")
          const originalTitle = movie.originalTitle.toLocaleLowerCase("fr-FR")
          if (!title.includes(q) && !originalTitle.includes(q)) return false
        }
        if (topics.length > 0) {
          const labels = [...movie.genres, ...movie.topics]
          if (!topics.some((topic) => labels.includes(topic))) return false
        }
        if (platforms.length > 0) {
          if (!platforms.some((platform) => movie.platforms.includes(platform))) return false
        }
        return true
      })
    : []

  const cinemaPageItems = filteredCinemaMovies.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )
  const sourceItems = isCinema ? cinemaPageItems : useSmartRerank ? [] : result!.items
  const totalItems = isCinema
    ? filteredCinemaMovies.length
    : useSmartRerank
      ? smart?.total ?? 0
      : result!.pagination.total
  const totalPages = isCinema
    ? Math.max(1, Math.ceil(filteredCinemaMovies.length / PAGE_SIZE))
    : useSmartRerank
      ? Math.max(1, Math.ceil((smart?.total ?? 0) / PAGE_SIZE))
      : result!.pagination.totalPages

  // Cinema + DB-browse share one mapping; the smart re-rank path maps its own
  // scored results below. Both produce the same grid-item shape.
  const dbItems = sourceItems.map((m) => {
    const cinemaReleaseBucket =
      "cinemaReleaseBucket" in m ? m.cinemaReleaseBucket : undefined
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
      type: m.type as "MOVIE" | "TV" | "GAME",
      title: m.title,
      posterUrl: m.posterUrl ?? null,
      cornerLabel:
        cinemaReleaseBucket === "reissue"
          ? "Reprise"
          : cinemaReleaseBucket === "upcoming"
            ? "Avant-prem."
            : null,
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

  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  const smartItems = (smart?.results ?? []).map((m) => ({
    id: m.mediaId,
    type: m.type as "MOVIE" | "TV" | "GAME",
    title: m.title,
    posterUrl: m.posterUrl ?? null,
    cornerLabel: null as string | null,
    expertAgeRec: m.expertAgeRec,
    genres: m.genres,
    releaseDate: m.releaseDate ? m.releaseDate.toISOString().split("T")[0] : null,
    contentMetrics: m.contentMetrics
      ? {
          violence: num(m.contentMetrics.violence),
          sexNudity: num(m.contentMetrics.sexNudity),
          language: num(m.contentMetrics.language),
          substanceUse: num(m.contentMetrics.substanceUse),
        }
      : null,
  }))

  const items = useSmartRerank ? smartItems : dbItems

  const filterSp = new URLSearchParams()
  if (search) filterSp.set("q", search)
  if (sortKey !== "releaseDate") filterSp.set("sort", sortKey)
  if (effectiveMinAge > DEFAULT_MIN_AGE)
    filterSp.set("minAge", String(effectiveMinAge))
  if (effectiveMaxAge < DEFAULT_MAX_AGE)
    filterSp.set("maxAge", String(effectiveMaxAge))
  if (platforms.length > 0) filterSp.set("platforms", platforms.join(","))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  if (memberIds.length > 0) filterSp.set("members", memberIds.join(","))
  // Carry the admin V2/classic override through pagination + the toggle.
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
        name: "Films",
        item: `${baseUrl}/films`,
      },
    ],
  }

  const itemListLd = items.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Films pour la famille",
        numberOfItems: totalItems,
        itemListElement: items.slice(0, 20).map((item, idx) => ({
          "@type": "ListItem",
          position: (page - 1) * PAGE_SIZE + idx + 1,
          url: `${baseUrl}/media/${encodeURIComponent(item.id)}`,
          name: item.title,
        })),
      }
    : null

  // Honest context banner: cinema films aren't on streaming, and a
  // personalized (member) view re-ranks only the top popularity window.
  const notice =
    isCinema && platforms.length > 0
      ? "En salle — le filtre plateforme ne s'applique pas aux films au cinéma."
      : useSmartRerank && smart?.capped
        ? "Vue personnalisée limitée aux titres les plus pertinents — affinez les filtres pour en voir plus."
        : undefined

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
      sort: isCinema ? "cinema" : sortKey,
      minAge: effectiveMinAge,
      maxAge: effectiveMaxAge,
      platforms,
      topics,
      familyMemberIds: memberIds,
    },
    filterQuery: filterSp.toString(),
    route: "/films",
    notice,
  }

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
      {showV2 ? (
        <CatalogueRedesign {...listProps} defaultSort="releaseDate" />
      ) : (
        <ApercuFilmsList {...listProps} />
      )}
    </>
  )
}
