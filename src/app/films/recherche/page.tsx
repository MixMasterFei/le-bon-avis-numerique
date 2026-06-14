import dynamic from "next/dynamic"
import { fetchMovies } from "@/lib/media-queries"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { runSmartFilter } from "@/lib/smart-filter"
import { FilmsRechercheLegacy } from "./FilmsRechercheLegacy"

export const revalidate = 300

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18
const PAGE_SIZE = 24

// Admin V2 renders the same CatalogueRedesign shell as /films (the owner chose
// "point /films/recherche to /films V2"). Code-split so it stays out of the
// public bundle; non-admin + ?v=classic get the legacy client search page.
const CatalogueRedesign = dynamic(() =>
  import("@/components/home-redesign/catalogue/CatalogueRedesign").then(
    (m) => m.CatalogueRedesign,
  ),
)

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function get(
  params: Record<string, string | string[] | undefined>,
  key: string,
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

export default async function FilmsRecherchePage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN"
  const showV2 = isAdmin && get(params, "v") !== "classic"

  // Public + classic fallback keep the legacy client search page untouched.
  if (!showV2) return <FilmsRechercheLegacy />

  const page = Math.max(1, parseInt2(get(params, "page"), 1))
  const search = (get(params, "q") ?? "").trim()
  const sortKey = parseSort(get(params, "sort") || get(params, "sortBy"))
  const memberIds = parseList(get(params, "members"))
  const platforms = parseList(get(params, "platforms"))
  // /films/recherche historically merges `genres` into `topics` (same API).
  const topics = [...new Set([...parseList(get(params, "topics")), ...parseList(get(params, "genres"))])]

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
      if (!get(params, "maxAge")) effectiveMaxAge = Math.min(DEFAULT_MAX_AGE, youngest)
      if (!get(params, "minAge")) effectiveMinAge = Math.max(DEFAULT_MIN_AGE, youngest - 3)
    }
  }

  const parseMetric = (key: string): number | undefined => {
    const raw = get(params, key)
    if (!raw) return undefined
    const n = parseInt(raw)
    return Number.isFinite(n) ? n : undefined
  }

  // Member selected + default sort → soft re-rank by family fit (nothing
  // hidden), same as /films.
  const useSmartRerank = !!userId && memberIds.length > 0 && sortKey === "releaseDate"

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

  const result = useSmartRerank
    ? null
    : await fetchMovies({
        page,
        limit: PAGE_SIZE,
        includeProvisional: true,
        minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
        maxAge: effectiveMaxAge <= DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        topics: topics.length > 0 ? topics : undefined,
        search: search || undefined,
        sortBy: sortKey !== "releaseDate" ? sortKey : undefined,
        requirePoster: true,
        language: "fr,en",
        maxViolence: parseMetric("maxViolence"),
        maxSexual: parseMetric("maxSexual"),
        maxLanguage: parseMetric("maxLanguage"),
        maxSubstance: parseMetric("maxSubstance"),
        maxConsumerism: parseMetric("maxConsumerism"),
      })

  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  const dbItems = (result?.items ?? []).map((m) => {
    const cm = m.contentMetrics as
      | { violence?: number | null; sexNudity?: number | null; language?: number | null; substanceUse?: number | null }
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
  if (sortKey !== "releaseDate") filterSp.set("sort", sortKey)
  if (effectiveMinAge > DEFAULT_MIN_AGE) filterSp.set("minAge", String(effectiveMinAge))
  if (effectiveMaxAge < DEFAULT_MAX_AGE) filterSp.set("maxAge", String(effectiveMaxAge))
  if (platforms.length > 0) filterSp.set("platforms", platforms.join(","))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  if (memberIds.length > 0) filterSp.set("members", memberIds.join(","))
  // showV2 here implies v is absent; keep the carrier consistent with /films.
  const variant = get(params, "v")
  if (variant) filterSp.set("v", variant)

  const notice =
    useSmartRerank && smart?.capped
      ? "Vue personnalisée limitée aux titres les plus pertinents — affinez les filtres pour en voir plus."
      : undefined

  return (
    <CatalogueRedesign
      items={items}
      total={totalItems}
      page={page}
      totalPages={totalPages}
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
      route="/films/recherche"
      notice={notice}
      eyebrow="Recherche"
      titlePrefix="Rechercher des"
      titleAccent="films"
      itemNoun={{ singular: "film", plural: "films" }}
      emptyTitle="Aucun film à afficher"
      mediaType="MOVIE"
      defaultSort="releaseDate"
    />
  )
}
