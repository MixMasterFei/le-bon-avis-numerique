import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuDecouverte } from "@/components/home-v2/ApercuDecouverte"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"
import type { ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { NewsCategoryKey } from "@/components/home-v2/apercuNewsLabels"
import type { Prisma, NewsCategory } from "@prisma/client"

export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"

interface SearchParams {
  font?: string
  cat?: string
}

function parseCategory(raw: string | undefined): NewsCategoryKey {
  if (raw === "PARENTHOOD" || raw === "FILM_TV" || raw === "GAMES" || raw === "READING") {
    return raw
  }
  return "ALL"
}

function toSources(raw: Prisma.JsonValue | null): NewsSourceRef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url) return []
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
      },
    ]
  })
}

export default async function ApercuDecouvertePage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const user = session?.user as { email?: string | null; role?: string } | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  const searchParams = await props.searchParams
  const activeCategory = parseCategory(searchParams?.cat)

  const where: { status: "PUBLISHED"; category?: NewsCategory } = { status: "PUBLISHED" }
  if (activeCategory !== "ALL") where.category = activeCategory

  const rows = await prisma.newsStory.findMany({
    where,
    orderBy: [{ relevanceScore: "desc" }, { publishedAt: "desc" }],
    take: 15,
  })

  const stories: ApercuNewsCardData[] = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    imageUrl: r.imageUrl,
    category: r.category,
    publishedAt: r.publishedAt,
    sources: toSources(r.sources),
  }))

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuDecouverte
        stories={stories}
        activeCategory={activeCategory}
        serifClass={serifClass}
      />
    </div>
  )
}
