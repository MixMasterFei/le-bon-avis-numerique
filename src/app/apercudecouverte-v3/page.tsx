import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuDecouverteV3, type DecouverteV3Data } from "@/components/home-v2/ApercuDecouverteV3"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"
import type { ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { StoryResearch } from "@/components/home-v2/ApercuDecouverteStory"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"
export const revalidate = 60 // 1-min ISR — cron writes news, page reads

interface SearchParams {
  font?: string
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

type StoryRow = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  imageUrl: string
  category: ApercuNewsCardData["category"]
  publishedAt: Date
  sources: Prisma.JsonValue
}

function rowToCard(row: StoryRow): ApercuNewsCardData {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    category: row.category,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
  }
}

/**
 * Pulls a "phrase du jour" candidate from a recent story body. Picks
 * the longest sentence under 220 chars from the most recent FR brief
 * — long enough to be substantive, short enough to render large.
 *
 * This is the Aperçu's quick-and-dirty source. The live cutover will
 * replace this with a daily LLM agent that picks more carefully.
 */
function extractPhrase(rows: StoryRow[]): { quote: string; storyTitle: string; storySlug: string } | null {
  for (const row of rows) {
    // Strip markdown headings + lists, then split on French sentence punct.
    const cleaned = row.body
      .replace(/^#+ .*$/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim()
    const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z«ÀÂÉÈÊËÎÏÔÙÛÜÇ])/)
    const candidates = sentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 60 && s.length <= 220 && !s.includes("**"))
      .sort((a, b) => b.length - a.length) // prefer longer (more substantive)
    if (candidates[0]) {
      return {
        quote: candidates[0].replace(/^[«"]|[»"]$/g, "").trim(),
        storyTitle: row.title,
        storySlug: row.slug,
      }
    }
  }
  return null
}

/**
 * Derive 3 short takeaways from the latest dossier's body. Splits on
 * sentences in the final paragraph and picks the 3 shortest substantive
 * ones. Aperçu placeholder; the live version will use a dedicated agent.
 */
function extractTakeaways(dossierBody: string | null): string[] {
  if (!dossierBody) return []
  const paragraphs = dossierBody.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  // Prefer the last paragraph (typically the "à retenir" closing).
  // Fall back to the second-to-last if the final is too short.
  const target = paragraphs[paragraphs.length - 1]?.length > 100
    ? paragraphs[paragraphs.length - 1]
    : paragraphs[paragraphs.length - 2] ?? paragraphs[paragraphs.length - 1] ?? ""
  if (!target) return []
  const sentences = target
    .replace(/\*\*/g, "")
    .split(/(?<=[.!?])\s+(?=[A-Z«ÀÂÉÈÊËÎÏÔÙÛÜÇ])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 180)
  return sentences.slice(0, 3)
}

export default async function ApercuDecouverteV3Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?next=/apercudecouverte-v3")
  }
  if (!session?.user?.id) {
    redirect("/connexion?next=/apercudecouverte-v3")
  }

  const searchParams = await props.searchParams

  // ── Pull data in parallel ──────────────────────────────────────
  const [frenchRows, intlRows, dossierRow, researchRow] = await Promise.all([
    // 12 most recent French briefs (1 hero + 3 top + ~8 older).
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", region: "FR" },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
      },
    }),
    // 6 most recent international briefs.
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", region: "INTL" },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
      },
    }),
    // Latest weekly dossier (past 14 days).
    prisma.newsStory.findFirst({
      where: {
        status: "PUBLISHED",
        storyType: "DOSSIER",
        publishedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
      },
    }),
    // Latest story carrying a populated research sidebar.
    prisma.newsStory.findFirst({
      where: { status: "PUBLISHED", research: { not: Prisma.JsonNull } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, slug: true, title: true, research: true,
      },
    }),
  ])

  const [frenchHero, ...frenchRest] = frenchRows
  const frenchTop = frenchRest.slice(0, 3)
  const olderBriefs = frenchRest.slice(3) // remainder

  const data: DecouverteV3Data = {
    frenchHero: frenchHero ? rowToCard(frenchHero) : null,
    frenchTop: frenchTop.map(rowToCard),
    internationalTop: intlRows.map(rowToCard),
    dossier: dossierRow ? rowToCard(dossierRow) : null,
    olderBriefs: olderBriefs.map(rowToCard),
    phrase: extractPhrase(frenchRows),
    takeaways: extractTakeaways(dossierRow?.body ?? null),
    research: researchRow
      ? (() => {
          const r = toResearch((researchRow as { research?: Prisma.JsonValue | null }).research ?? null)
          return r
            ? { research: r, storyTitle: researchRow.title, storySlug: researchRow.slug }
            : null
        })()
      : null,
  }

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuDecouverteV3 data={data} serifClass={serifClass} />
    </div>
  )
}
