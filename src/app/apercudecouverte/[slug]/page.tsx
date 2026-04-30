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

/**
 * Strip "(article N)" leaks from dossier bodies. The synthesis agent
 * is shown briefs prefixed with [0], [1], … and sometimes references
 * them in prose as "Selon Numerama (article 3)". The numbers carry no
 * meaning to the reader — strip them. Prompt fix in news-dossier.ts
 * prevents new occurrences but existing dossiers already in DB still
 * need this on render.
 */
function stripInternalRefs(body: string): string {
  return body.replace(/\s*\(article\s+\d+\)/gi, "")
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
  // Dedup by publisher name at render time. Older dossiers in DB
  // were aggregated with URL-based dedup (one pill per article URL),
  // which produces "La Croix Enfants & ados · La Croix Enfants &
  // ados · …" when multiple La Croix articles were cited. New
  // dossiers dedup by name at synthesis time; this guards the older
  // rows already in storage.
  const seen = new Set<string>()
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url || seen.has(name)) return []
    seen.add(name)
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
        country: typeof e.country === "string" ? e.country : undefined,
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

  // Pull catalog rows for all matched subjects (up to 3, in order
  // of first mention). Renders as mini-cards at the bottom of the
  // body — replaces the prior single-CTA + inline-links approach
  // (Xavier preferred clean prose with explicit cards over scattered
  // links).
  const idsRaw = (row as { relatedMediaIds?: string[] | null }).relatedMediaIds ?? []
  const fallbackId = (row as { relatedMediaId?: string | null }).relatedMediaId
  const relatedIds: string[] = idsRaw.length > 0 ? idsRaw : fallbackId ? [fallbackId] : []
  let relatedMediaList: NonNullable<ApercuStoryDetail["relatedMediaList"]> = []
  if (relatedIds.length > 0) {
    try {
      const rows = await prisma.mediaItem.findMany({
        where: { id: { in: relatedIds } },
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          expertAgeRec: true,
          genres: true,
          releaseDate: true,
        },
      })
      // Preserve the matched-order rather than DB row order.
      const byId = new Map(rows.map((r) => [r.id, r]))
      relatedMediaList = relatedIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          posterUrl: r.posterUrl,
          expertAgeRec: r.expertAgeRec,
          genres: r.genres ?? [],
          releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
        }))
    } catch {
      // Catalog read blip — render the body without related cards.
    }
  }

  const story: ApercuStoryDetail = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: stripInternalRefs(row.body),
    category: row.category,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
    research: toResearch((row as { research?: Prisma.JsonValue | null }).research ?? null),
    relatedMediaList,
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
