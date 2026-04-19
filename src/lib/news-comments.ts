import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const REACTION_TYPES = ["THUMBS_UP", "HEART", "QUESTION"] as const
export type NewsReactionType = (typeof REACTION_TYPES)[number]

export const BODY_MIN = 1
export const BODY_MAX = 1500

export interface HydratedComment {
  id: string
  body: string
  status: "VISIBLE" | "HIDDEN" | "DELETED"
  editedAt: Date | null
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    avatarStyle: string | null
    avatarSeed: string | null
    avatarOptions: Record<string, unknown> | null
  }
  reactions: Record<NewsReactionType, number>
  myReactions: NewsReactionType[] // empty if not logged in
  canEdit: boolean
  canDelete: boolean
}

const commentInclude = {
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
  reactions: {
    select: { userId: true, type: true },
  },
} satisfies Prisma.NewsCommentInclude

type CommentWithRelations = Prisma.NewsCommentGetPayload<{ include: typeof commentInclude }>

function countReactions(reactions: CommentWithRelations["reactions"]): Record<NewsReactionType, number> {
  const out: Record<NewsReactionType, number> = { THUMBS_UP: 0, HEART: 0, QUESTION: 0 }
  for (const r of reactions) {
    if ((REACTION_TYPES as readonly string[]).includes(r.type)) {
      out[r.type as NewsReactionType] += 1
    }
  }
  return out
}

function userReactions(
  reactions: CommentWithRelations["reactions"],
  viewerId: string | null,
): NewsReactionType[] {
  if (!viewerId) return []
  const out = new Set<NewsReactionType>()
  for (const r of reactions) {
    if (r.userId === viewerId && (REACTION_TYPES as readonly string[]).includes(r.type)) {
      out.add(r.type as NewsReactionType)
    }
  }
  return Array.from(out)
}

export function hydrateComment(c: CommentWithRelations, viewerId: string | null): HydratedComment {
  const isOwner = viewerId !== null && c.userId === viewerId
  return {
    id: c.id,
    body: c.status === "DELETED" ? "" : c.body,
    status: c.status,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    user: {
      id: c.user.id,
      name: c.user.name,
      email: c.user.email,
      image: c.user.image,
      avatarStyle: c.user.avatarStyle,
      avatarSeed: c.user.avatarSeed,
      avatarOptions: (c.user.avatarOptions as Record<string, unknown> | null) ?? null,
    },
    reactions: countReactions(c.reactions),
    myReactions: userReactions(c.reactions, viewerId),
    canEdit: isOwner && c.status === "VISIBLE",
    canDelete: isOwner && c.status !== "DELETED",
  }
}

export async function fetchComments(
  storyId: string,
  viewerId: string | null,
  limit = 20,
): Promise<HydratedComment[]> {
  const rows = await prisma.newsComment.findMany({
    where: {
      newsStoryId: storyId,
      status: { in: ["VISIBLE", "DELETED"] }, // keep deleted tombstones, hide moderated
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: commentInclude,
  })
  return rows.map((r) => hydrateComment(r, viewerId))
}

export function validateBody(body: unknown): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof body !== "string") return { ok: false, error: "body requis" }
  const trimmed = body.trim()
  if (trimmed.length < BODY_MIN) return { ok: false, error: "Commentaire vide" }
  if (trimmed.length > BODY_MAX) return { ok: false, error: `Commentaire trop long (max ${BODY_MAX} caractères)` }
  return { ok: true, body: trimmed }
}
