import type { Metadata } from "next"
import { fetchMovies } from "@/lib/media-queries"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"

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
  return raw === "quality" || raw === "title" ? raw : "releaseDate"
}

export async function generateMetadata({
  searchParams,
}: FilmsPageProps): Promise<Metadata> {
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

  let title = "Films — Avis et âges recommandés pour la famille"
  let description =
    "Les meilleurs films pour votre famille : analyses détaillées, violence, langage, messages positifs. Recommandations d'âge par des experts."

  if (q) {
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

  const page = Math.max(1, parseInt2(get(params, "page"), 1))
  const search = (get(params, "q") ?? "").trim()
  const sortKey = parseSort(get(params, "sort") || get(params, "sortBy"))
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

  const result = await fetchMovies({
    page,
    limit: PAGE_SIZE,
    minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
    // <= (not <) so maxAge=18 from the homepage "16+" age tile is
    // treated as a real filter (expertAgeRec ≤ 18 AND NOT NULL),
    // not silently dropped. Without this, the 16+ tile routes to
    // the same page as the default browse with no visible filter.
    maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    topics: topics.length > 0 ? topics : undefined,
    search: search || undefined,
    sortBy: sortKey !== "releaseDate" ? sortKey : undefined,
    requirePoster: true,
    language: "fr,en",
    maxViolence,
    maxSexual,
    maxLanguage,
    maxSubstance,
    maxConsumerism,
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
      type: m.type as "MOVIE" | "TV" | "GAME",
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
  if (sortKey !== "releaseDate") filterSp.set("sort", sortKey)
  if (effectiveMinAge > DEFAULT_MIN_AGE)
    filterSp.set("minAge", String(effectiveMinAge))
  if (effectiveMaxAge < DEFAULT_MAX_AGE)
    filterSp.set("maxAge", String(effectiveMaxAge))
  if (platforms.length > 0) filterSp.set("platforms", platforms.join(","))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  if (memberIds.length > 0) filterSp.set("members", memberIds.join(","))

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

  const itemListLd = result.items.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Films pour la famille",
        numberOfItems: result.pagination.total,
        itemListElement: result.items.slice(0, 20).map((item, idx) => ({
          "@type": "ListItem",
          position: (page - 1) * PAGE_SIZE + idx + 1,
          url: `${baseUrl}/media/${encodeURIComponent(item.id)}`,
          name: item.title,
        })),
      }
    : null

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
      <ApercuFilmsList
        items={items}
        total={result.pagination.total}
        page={page}
        totalPages={result.pagination.totalPages}
        serifClass="font-serif"
        familyMembers={familyMembers.map((m) => ({
          id: m.id,
          name: m.name,
          birthYear: m.birthYear,
          birthMonth: m.birthMonth,
          avatarEmoji: m.avatarEmoji,
          avatarStyle: m.avatarStyle,
          avatarSeed: m.avatarSeed,
          avatarOptions: m.avatarOptions as Record<string, unknown> | null,
        }))}
        initialFilters={{
          search,
          sort: sortKey,
          minAge: effectiveMinAge,
          maxAge: effectiveMaxAge,
          platforms,
          topics,
          familyMemberIds: memberIds,
        }}
        filterQuery={filterSp.toString()}
        route="/films"
      />
    </>
  )
}
