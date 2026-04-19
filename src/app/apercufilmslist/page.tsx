import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fetchMovies } from "@/lib/media-queries"
import { getMemberAge } from "@/lib/age-utils"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"
const PAGE_SIZE = 24
const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

interface SearchParams {
  font?: string
  q?: string
  sort?: string
  minAge?: string
  maxAge?: string
  platforms?: string
  topics?: string
  members?: string
  page?: string
}

function parseSort(raw: string | undefined): string {
  return raw === "quality" || raw === "title" ? raw : "releaseDate"
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

export default async function ApercuFilmsListPage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  const searchParams = await props.searchParams
  const search = (searchParams?.q ?? "").trim()
  const sortKey = parseSort(searchParams?.sort)
  const memberIds = parseList(searchParams?.members)
  const platforms = parseList(searchParams?.platforms)
  const topics = parseList(searchParams?.topics)
  const pageNum = Math.max(1, parseInt2(searchParams?.page, 1))

  // Fetch family members so the sidebar can show them as select-able
  // chips. Same data /api/user/family returns, but pulled server-side
  // so the sidebar hydrates with real members on first paint.
  const familyMembers = user?.id
    ? await prisma.familyMember.findMany({
        where: { userId: user.id },
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

  // If members are selected, derive an age band centered on the youngest
  // selected member (±3 years) so the grid narrows to age-appropriate
  // content rather than including everything from toddler-safe upwards.
  // Explicit URL params always win over the auto-band.
  let effectiveMinAge = parseInt2(searchParams?.minAge, DEFAULT_MIN_AGE)
  let effectiveMaxAge = parseInt2(searchParams?.maxAge, DEFAULT_MAX_AGE)

  if (memberIds.length > 0) {
    const selectedAges = memberIds
      .map((id) => familyMembers.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => getMemberAge(m.birthYear, m.birthMonth))
      .filter((a): a is number => a !== null)
    if (selectedAges.length > 0) {
      const youngest = Math.min(...selectedAges)
      if (!searchParams?.maxAge) {
        effectiveMaxAge = Math.min(DEFAULT_MAX_AGE, youngest + 3)
      }
      if (!searchParams?.minAge) {
        effectiveMinAge = Math.max(DEFAULT_MIN_AGE, youngest - 3)
      }
    }
  }

  const result = await fetchMovies({
    page: pageNum,
    limit: PAGE_SIZE,
    minAge: effectiveMinAge > DEFAULT_MIN_AGE ? effectiveMinAge : undefined,
    maxAge: effectiveMaxAge < DEFAULT_MAX_AGE ? effectiveMaxAge : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    topics: topics.length > 0 ? topics : undefined,
    search: search || undefined,
    sortBy: sortKey === "releaseDate" ? undefined : sortKey,
    requirePoster: true,
    language: "fr,en",
  })

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

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

  // Build the filter-query string the pagination hrefs need so
  // page navigation preserves all active filters.
  const filterSp = new URLSearchParams()
  if (searchParams?.font) filterSp.set("font", searchParams.font)
  if (search) filterSp.set("q", search)
  if (sortKey !== "releaseDate") filterSp.set("sort", sortKey)
  if (effectiveMinAge > DEFAULT_MIN_AGE) filterSp.set("minAge", String(effectiveMinAge))
  if (effectiveMaxAge < DEFAULT_MAX_AGE) filterSp.set("maxAge", String(effectiveMaxAge))
  if (platforms.length > 0) filterSp.set("platforms", platforms.join(","))
  if (topics.length > 0) filterSp.set("topics", topics.join(","))
  if (memberIds.length > 0) filterSp.set("members", memberIds.join(","))

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuFilmsList
        items={items}
        total={result.pagination.total}
        page={pageNum}
        totalPages={result.pagination.totalPages}
        serifClass={serifClass}
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
      />
    </div>
  )
}
