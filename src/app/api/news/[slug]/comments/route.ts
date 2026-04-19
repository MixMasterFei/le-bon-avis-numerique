import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  fetchComments,
  hydrateComment,
  validateBody,
} from "@/lib/news-comments"

interface RouteContext {
  params: Promise<{ slug: string }>
}

async function findStoryId(slug: string): Promise<string | null> {
  const row = await prisma.newsStory.findUnique({
    where: { slug },
    select: { id: true },
  })
  return row?.id ?? null
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params
    const storyId = await findStoryId(slug)
    if (!storyId) {
      return NextResponse.json({ error: "Histoire introuvable" }, { status: 404 })
    }

    const session = await auth()
    const viewerId = session?.user?.id ?? null
    const comments = await fetchComments(storyId, viewerId)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Error fetching news comments:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { slug } = await ctx.params
    const storyId = await findStoryId(slug)
    if (!storyId) {
      return NextResponse.json({ error: "Histoire introuvable" }, { status: 404 })
    }

    const payload = await req.json().catch(() => null)
    const validated = validateBody(payload?.body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const created = await prisma.newsComment.create({
      data: {
        newsStoryId: storyId,
        userId: session.user.id,
        body: validated.body,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            avatarStyle: true,
            avatarSeed: true,
            avatarOptions: true,
          },
        },
        reactions: { select: { userId: true, type: true } },
      },
    })

    return NextResponse.json({ comment: hydrateComment(created, session.user.id) }, { status: 201 })
  } catch (error) {
    console.error("Error creating news comment:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
