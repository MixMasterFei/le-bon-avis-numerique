import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { fetchMovies } from "@/lib/media-queries"
import { ApercuFilmsList } from "@/components/home-v2/ApercuFilmsList"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces, APERCU_AGE_BUCKETS, type ApercuAgeBucket } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"
const PAGE_SIZE = 24

const SORT_OPTIONS = [
  { key: "releaseDate", label: "Récents" },
  { key: "quality", label: "Mieux notés" },
  { key: "title", label: "A → Z" },
] as const

type SortKey = (typeof SORT_OPTIONS)[number]["key"]

interface SearchParams {
  font?: string
  sort?: string
  age?: string
  page?: string
}

function parseSort(raw: string | undefined): SortKey {
  if (raw === "quality" || raw === "title" || raw === "releaseDate") return raw
  return "releaseDate"
}

function findAgeBucket(key: string | undefined): ApercuAgeBucket | null {
  if (!key) return null
  return APERCU_AGE_BUCKETS.find((b) => b.key === key) ?? null
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
    | { email?: string | null; role?: string }
    | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  const searchParams = await props.searchParams
  const sortKey = parseSort(searchParams?.sort)
  const ageBucket = findAgeBucket(searchParams?.age)
  const pageNum = Math.max(1, parseInt(searchParams?.page ?? "1") || 1)

  // Reuse the canonical movies query so the listing reflects the
  // same data the live /films page uses.
  const result = await fetchMovies({
    page: pageNum,
    limit: PAGE_SIZE,
    maxAge: ageBucket?.maxAge,
    maxViolence: ageBucket?.caps.maxViolence,
    maxSexual: ageBucket?.caps.maxSexual,
    maxLanguage: ageBucket?.caps.maxLanguage,
    maxSubstance: ageBucket?.caps.maxSubstance,
    sortBy: sortKey === "releaseDate" ? undefined : sortKey,
    requirePoster: true,
    language: "fr,en",
  })

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  const items = result.items.map((m) => ({
    id: m.id,
    type: m.type as "MOVIE" | "TV" | "GAME",
    title: m.title,
    posterUrl: m.posterUrl ?? null,
    expertAgeRec: m.expertAgeRec,
    genres: m.genres,
    releaseDate: m.releaseDate,
  }))

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuFilmsList
        items={items}
        total={result.pagination.total}
        page={pageNum}
        totalPages={result.pagination.totalPages}
        sortKey={sortKey}
        sortOptions={SORT_OPTIONS as unknown as { key: string; label: string }[]}
        activeAgeKey={ageBucket?.key ?? null}
        ageBuckets={APERCU_AGE_BUCKETS}
        serifClass={serifClass}
      />
    </div>
  )
}
