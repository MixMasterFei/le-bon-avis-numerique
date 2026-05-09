import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const NOTIFICATION_TYPES = {
  NEWS_COMMENT_THREAD: "NEWS_COMMENT_THREAD",
  NEWS_COMMENT_REACTION: "NEWS_COMMENT_REACTION",
  MAJOR_NEWS: "MAJOR_NEWS",
  MAJOR_RELEASE: "MAJOR_RELEASE",
  SITE_UPDATE: "SITE_UPDATE",
  SAVED_NEWS_UPDATE: "SAVED_NEWS_UPDATE",
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export type NotificationPriority = "LOW" | "NORMAL" | "IMPORTANT"

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  href?: string | null
  priority?: NotificationPriority
  metadata?: Prisma.InputJsonValue
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      priority: input.priority ?? "NORMAL",
      metadata: input.metadata ?? undefined,
    },
  })
}

export async function notifyNewsCommentParticipants({
  storyId,
  actorUserId,
  actorName,
}: {
  storyId: string
  actorUserId: string
  actorName: string | null | undefined
}) {
  const story = await prisma.newsStory.findUnique({
    where: { id: storyId },
    select: { title: true, slug: true },
  })
  if (!story) return

  const participants = await prisma.newsComment.findMany({
    where: {
      newsStoryId: storyId,
      userId: { not: actorUserId },
      status: { in: ["VISIBLE", "DELETED"] },
    },
    distinct: ["userId"],
    select: { userId: true },
  })

  if (participants.length === 0) return

  const displayName = actorName?.trim() || "Un membre"
  await prisma.notification.createMany({
    data: participants.map((participant) => ({
      userId: participant.userId,
      type: NOTIFICATION_TYPES.NEWS_COMMENT_THREAD,
      priority: "NORMAL",
      title: "Nouveau commentaire",
      body: `${displayName} a ajoute un commentaire sur "${story.title}".`,
      href: `/apercudecouverte/${story.slug}#commentaires`,
      metadata: {
        storyId,
        slug: story.slug,
        actorUserId,
      },
    })),
  })
}

export async function notifyNewsCommentReaction({
  commentId,
  actorUserId,
  reactionType,
}: {
  commentId: string
  actorUserId: string
  reactionType: string
}) {
  const comment = await prisma.newsComment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      newsStory: {
        select: { id: true, slug: true, title: true },
      },
    },
  })
  if (!comment || comment.userId === actorUserId) return

  await createNotification({
    userId: comment.userId,
    type: NOTIFICATION_TYPES.NEWS_COMMENT_REACTION,
    title: "Reaction a votre commentaire",
    body: `Votre commentaire sur "${comment.newsStory.title}" a recu une reaction.`,
    href: `/apercudecouverte/${comment.newsStory.slug}#commentaires`,
    metadata: {
      storyId: comment.newsStory.id,
      slug: comment.newsStory.slug,
      commentId,
      actorUserId,
      reactionType,
    },
  })
}
