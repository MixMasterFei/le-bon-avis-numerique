import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/reactions/all — every reaction across the user's family
// members, as a compact { [mediaId]: { [memberId]: ReactionType } } map.
// Powers the poster-action bars' initial state so a title already marked
// shows its state on load. Reactions are sparse (one row per member/title
// actually reacted to), so this is a small single query — loaded once per
// page and shared client-side (see useUserReactions).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ reactions: {} })

  const members = await prisma.familyMember.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (members.length === 0) return NextResponse.json({ reactions: {} })

  const rows = await prisma.mediaReaction.findMany({
    where: { familyMemberId: { in: members.map((m) => m.id) } },
    select: { mediaId: true, familyMemberId: true, reaction: true },
  })

  const reactions: Record<string, Record<string, string>> = {}
  for (const r of rows) {
    ;(reactions[r.mediaId] ??= {})[r.familyMemberId] = r.reaction
  }

  return NextResponse.json({ reactions })
}
