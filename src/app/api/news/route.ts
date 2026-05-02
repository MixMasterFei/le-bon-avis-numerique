import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma, NewsCategory } from "@prisma/client"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"

const PAGE_SIZE = 24

function parseCategory(raw: string | null): NewsCategory | null {
  if (
    raw === "PARENTHOOD" ||
    raw === "FILM_TV" ||
    raw === "GAMES" ||
    raw === "READING" ||
    raw === "TECH"
  ) {
    return raw
  }
  return null
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

/**
 * Paginated news listing for /apercudecouverte/actualites' "Charger
 * plus" button. Cursor-based for stable ordering. Login required —
 * the page itself is auth-gated.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get("cursor") // story id of the last item the client already has
    const category = parseCategory(searchParams.get("cat"))
    const rawRegion = searchParams.get("region")
    const region = rawRegion === "FR" || rawRegion === "INTL" ? rawRegion : null

    // storyType: "BRIEF" mirrors the constraint applied by the
    // /apercudecouverte/actualites server-rendered page. Without it,
    // "Charger plus" pagination would mix in DOSSIERs (long-reads),
    // since cursor-based pagination is unaware of the page's render
    // filter and DOSSIERs share the same publishedAt ordering.
    const where: Prisma.NewsStoryWhereInput = {
      status: "PUBLISHED",
      storyType: "BRIEF",
    }
    if (category) where.category = category
    if (region) where.region = region

    // Fetch one extra item to know whether there's a next page without
    // a separate count query.
    const rows = await prisma.newsStory.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        imageUrl: true,
        imageCredit: true,
        imageLicenseUrl: true,
        category: true,
        publishedAt: true,
        sources: true,
      },
    })

    const hasMore = rows.length > PAGE_SIZE
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
    const nextCursor = hasMore ? page[page.length - 1].id : null

    return NextResponse.json({
      stories: page.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        imageUrl: r.imageUrl,
        imageCredit: r.imageCredit,
        imageLicenseUrl: r.imageLicenseUrl,
        category: r.category,
        publishedAt: r.publishedAt,
        sources: toSources(r.sources),
      })),
      nextCursor,
      hasMore,
    })
  } catch (error) {
    console.error("Error listing news:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
