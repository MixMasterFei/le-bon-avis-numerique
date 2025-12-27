import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all stats in parallel
    const [
      reviewCount,
      favoriteCount,
      watchlistCount,
      familyMemberCount,
      reactionCount,
      user,
    ] = await Promise.all([
      prisma.review.count({ where: { userId } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.watchlist.count({ where: { userId } }),
      prisma.familyMember.count({ where: { userId } }),
      prisma.mediaReaction.count({
        where: {
          familyMember: { userId }
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true }
      })
    ])

    return NextResponse.json({
      reviews: reviewCount,
      favorites: favoriteCount,
      watchlist: watchlistCount,
      familyMembers: familyMemberCount,
      reactions: reactionCount,
      memberSince: user?.createdAt || new Date(),
    })
  } catch (error) {
    console.error("User stats error:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
