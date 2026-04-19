import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuDecouverteStory, type ApercuStoryDetail } from "@/components/home-v2/ApercuDecouverteStory"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"

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

export default async function ApercuDecouverteStoryPage(props: {
  params: Promise<{ slug: string }>
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

  const { slug } = await props.params
  const row = await prisma.newsStory.findUnique({ where: { slug } })
  if (!row) notFound()

  const story: ApercuStoryDetail = {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
  }

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuDecouverteStory story={story} serifClass={serifClass} />
    </div>
  )
}
