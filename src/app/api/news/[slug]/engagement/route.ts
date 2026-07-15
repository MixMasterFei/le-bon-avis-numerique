import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isDislikeReason, MAX_REASON_NOTE_LENGTH } from "@/lib/news-feedback"
import { sanitizeInput } from "@/lib/security"

/** Prisma P2022: the column does not exist (migration not applied yet). */
function isMissingColumnError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022"
}

const STORY_REACTIONS = ["LIKE", "DISLIKE"] as const
type StoryReaction = (typeof STORY_REACTIONS)[number]

interface RouteContext {
  params: Promise<{ slug: string }>
}

function isStoryReaction(value: unknown): value is StoryReaction {
  return typeof value === "string" && (STORY_REACTIONS as readonly string[]).includes(value)
}

async function findStoryId(slug: string): Promise<string | null> {
  const row = await prisma.newsStory.findUnique({
    where: { slug },
    select: { id: true },
  })
  return row?.id ?? null
}

async function getEngagement(storyId: string, userId: string | null) {
  const [likes, dislikes, myReaction, saved] = await Promise.all([
    prisma.newsStoryReaction.count({ where: { newsStoryId: storyId, type: "LIKE" } }),
    prisma.newsStoryReaction.count({ where: { newsStoryId: storyId, type: "DISLIKE" } }),
    userId
      ? prisma.newsStoryReaction.findUnique({
          where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
          select: { type: true },
        })
      : Promise.resolve(null),
    userId
      ? prisma.newsSavedStory.findUnique({
          where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
          select: { createdAt: true, readAt: true },
        })
      : Promise.resolve(null),
  ])

  return {
    reactions: { LIKE: likes, DISLIKE: dislikes },
    myReaction: isStoryReaction(myReaction?.type) ? myReaction.type : null,
    saved: !!saved,
    savedAt: saved?.createdAt ?? null,
    readAt: saved?.readAt ?? null,
  }
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params
    const storyId = await findStoryId(slug)
    if (!storyId) {
      return NextResponse.json({ error: "Actualite introuvable" }, { status: 404 })
    }

    const session = await auth()
    const userId = session?.user?.id ?? null
    return NextResponse.json(await getEngagement(storyId, userId))
  } catch (error) {
    console.error("Error fetching news story engagement:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }
    const userId = session.user.id

    const { slug } = await ctx.params
    const storyId = await findStoryId(slug)
    if (!storyId) {
      return NextResponse.json({ error: "Actualite introuvable" }, { status: 404 })
    }

    const payload = await req.json().catch(() => null)
    const action = typeof payload?.action === "string" ? payload.action : ""

    if (action === "reaction") {
      const type = payload?.type
      if (!isStoryReaction(type)) {
        return NextResponse.json({ error: "Type de reaction invalide" }, { status: 400 })
      }

      // Optional "why" — only meaningful on a DISLIKE. Code must be in the
      // fixed vocabulary (news-feedback.ts); the note is free text, sanitized
      // and capped.
      const reasonCode =
        type === "DISLIKE" && isDislikeReason(payload?.reasonCode) ? payload.reasonCode : null
      const reasonNote =
        type === "DISLIKE" && typeof payload?.reasonNote === "string" && payload.reasonNote.trim()
          ? sanitizeInput(payload.reasonNote).slice(0, MAX_REASON_NOTE_LENGTH) || null
          : null
      const hasReason = Boolean(reasonCode || reasonNote)

      const existing = await prisma.newsStoryReaction.findUnique({
        where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
      })

      // Toggle-off is EXPLICIT (client sends remove:true from its own state).
      // The legacy inference — same type arriving without a reason — is kept
      // only for stale cached clients, and it's what made the two-step
      // "dislike, then reason" flow racy: if the reasonless request was
      // reordered AFTER the reason request, it read the row the reason
      // request created as a toggle-off and deleted both.
      const explicitRemove = payload?.remove === true
      const legacyToggleOff =
        payload?.remove === undefined && existing?.type === type && !hasReason

      if (explicitRemove || legacyToggleOff) {
        await prisma.newsStoryReaction.deleteMany({
          where: { newsStoryId: storyId, userId },
        })
      } else {
        // Reason fields are only WRITTEN when the request carries one or the
        // reaction type changes (a LIKE clears a stale dislike reason). A
        // same-type reasonless write must NOT wipe a reason that another
        // request (or device) already attached.
        const typeChanged = existing !== null && existing.type !== type
        const reasonUpdate =
          hasReason || typeChanged ? { reasonCode, reasonNote } : {}
        try {
          await prisma.newsStoryReaction.upsert({
            where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
            update: { type, ...reasonUpdate },
            create: { newsStoryId: storyId, userId, type, reasonCode, reasonNote },
          })
        } catch (err) {
          // Deploy-order guard, NARROW: only a missing reason column
          // (P2022, sql/add_news_reaction_reason.sql not applied) retries
          // without the reason. Anything else is a real failure and bubbles.
          if (!isMissingColumnError(err)) throw err
          console.warn("[news-engagement] reason columns missing, storing reaction alone")
          await prisma.newsStoryReaction.upsert({
            where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
            update: { type },
            create: { newsStoryId: storyId, userId, type },
          })
        }
      }
    } else if (action === "save") {
      const saved = Boolean(payload?.saved)
      if (saved) {
        await prisma.newsSavedStory.upsert({
          where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
          update: {},
          create: { newsStoryId: storyId, userId },
        })
      } else {
        await prisma.newsSavedStory.deleteMany({
          where: { newsStoryId: storyId, userId },
        })
      }
    } else if (action === "read") {
      const read = Boolean(payload?.read)
      await prisma.newsSavedStory.upsert({
        where: { newsStoryId_userId: { newsStoryId: storyId, userId } },
        update: { readAt: read ? new Date() : null },
        create: { newsStoryId: storyId, userId, readAt: read ? new Date() : null },
      })
    } else {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 })
    }

    return NextResponse.json(await getEngagement(storyId, userId))
  } catch (error) {
    console.error("Error updating news story engagement:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
