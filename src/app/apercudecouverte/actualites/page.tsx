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

interface SearchParams {
  font?: string
  cat?: string
  region?: string
}

function parseCategory(raw: string | undefined): NewsCategoryKey {
  if (raw === "PARENTHOOD" || raw === "FILM_TV" || raw === "GAMES" || raw === "READING") {
    return raw
  }
  return "ALL"
}

// "FR" = domestic strand (default), "INTL" = Vu d'ailleurs.
// Anything else falls back to "ALL" (mixed).
function parseRegion(raw: string | undefined): "ALL" | "FR" | "INTL" {
  if (raw === "FR" || raw === "INTL") return raw
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

export default async function ApercuDecouverteActualitesPage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?next=/apercudecouverte/actualites")
  }
  if (!session?.user?.id) {
    redirect("/connexion?next=/apercudecouverte/actualites")
  }
  // Refresh capability deliberately not surfaced on the user-facing
  // page (see canRefresh={false} below). News updates run via the
  // server cron automatically.

  const searchParams = await props.searchParams
  const activeCategory = parseCategory(searchParams?.cat)
  const activeRegion = parseRegion(searchParams?.region)

  const where: { status: "PUBLISHED"; category?: NewsCategory; region?: string } = {
    status: "PUBLISHED",
  }
  if (activeCategory !== "ALL") where.category = activeCategory
  if (activeRegion !== "ALL") where.region = activeRegion

  // Fetch one extra row so we know whether a "Charger plus" page exists
  // without an extra count query. Order matches the API's pagination
  // (publishedAt desc + id desc tiebreak) so cursor logic stays aligned.
  const rows = await prisma.newsStory.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 24 + 1,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      imageUrl: true,
      category: true,
      publishedAt: true,
      sources: true,
    },
  })

  const hasMore = rows.length > 24
  const page = hasMore ? rows.slice(0, 24) : rows
  const initialNextCursor = hasMore ? page[page.length - 1].id : null

  const stories: ApercuNewsCardData[] = page.map((r) => ({
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
        activeRegion={activeRegion}
        serifClass={serifClass}
        // User-facing page should never expose a manual refresh button —
        // news must auto-update server-side via the cron. Admin trigger
        // still exists at /admin if a manual run is ever needed.
        canRefresh={false}
        initialNextCursor={initialNextCursor}
      />
    </div>
  )
}
