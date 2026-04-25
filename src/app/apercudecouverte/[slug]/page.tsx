import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  ApercuDecouverteStory,
  type ApercuStoryDetail,
  type StoryResearch,
} from "@/components/home-v2/ApercuDecouverteStory"
import { NewsComments } from "@/components/home-v2/NewsComments"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

interface SearchParams {
  font?: string
}

function toResearch(raw: Prisma.JsonValue | null): StoryResearch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.studyTitle !== "string" ||
    typeof r.organization !== "string" ||
    typeof r.methodology !== "string" ||
    typeof r.keyFinding !== "string"
  ) {
    return null
  }
  return {
    studyTitle: r.studyTitle,
    organization: r.organization,
    year: typeof r.year === "number" ? r.year : null,
    methodology: r.methodology,
    keyFinding: r.keyFinding,
    caveat: typeof r.caveat === "string" ? r.caveat : undefined,
    sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : undefined,
  }
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

export default async function ApercuDecouverteStoryPage(props: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<SearchParams>
}) {
  const { slug } = await props.params

  let session
  try {
    session = await auth()
  } catch {
    redirect(`/connexion?next=/apercudecouverte/${slug}`)
  }
  if (!session?.user?.id) {
    redirect(`/connexion?next=/apercudecouverte/${slug}`)
  }
  const viewerId = session.user.id

  const row = await prisma.newsStory.findUnique({ where: { slug } })
  if (!row) notFound()

  const story: ApercuStoryDetail = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
    research: toResearch((row as { research?: Prisma.JsonValue | null }).research ?? null),
  }

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuDecouverteStory
        story={story}
        serifClass={serifClass}
        commentsSlot={
          <NewsComments
            storyId={story.id}
            slug={story.slug}
            serifClass={serifClass}
            viewerId={viewerId}
          />
        }
      />
    </div>
  )
}
