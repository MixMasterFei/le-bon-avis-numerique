import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/news/feedback/all — the signed-in user's news reactions as a
// compact { [storySlug]: "LIKE" | "DISLIKE" } map. Powers the inline
// feedback buttons on feed cards so a story already marked shows its state
// on load (one query for the whole feed — same pattern as
// /api/user/reactions/all for posters).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ feedback: {} })

  const rows = await prisma.newsStoryReaction.findMany({
    where: { userId: session.user.id },
    select: { type: true, newsStory: { select: { slug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  })

  const feedback: Record<string, string> = {}
  for (const r of rows) feedback[r.newsStory.slug] = r.type

  return NextResponse.json({ feedback })
}
