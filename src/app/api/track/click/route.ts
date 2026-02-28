import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST — Track a recommendation click (fire-and-forget from client)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, source } = body

    if (!mediaId || !source) {
      return NextResponse.json({ error: "mediaId and source required" }, { status: 400 })
    }

    const validSources = [
      "homepage_expert_picks",
      "homepage_featured",
      "homepage_cinema",
      "homepage_streaming",
      "homepage_collections",
      "homepage_new_arrivals",
      "detail_similar",
      "profile_reco",
      "family_night",
      "search",
      "age_filter",
    ]

    if (!validSources.includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 })
    }

    // Get user ID if authenticated (optional)
    const session = await auth()
    const userId = session?.user?.id || null

    await prisma.recoClick.create({
      data: { mediaId, source, userId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Silently fail — tracking should never break the UX
    console.error("RecoClick error:", error)
    return NextResponse.json({ ok: true })
  }
}
