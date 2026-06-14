import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runSmartFilter } from "@/lib/smart-filter"

// POST /api/filter/smart - Filter media using family preferences.
// Thin wrapper over the shared engine (src/lib/smart-filter.ts); this surface
// HIDES below-bar content (strictMode/minScore from the body).
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { familyMemberIds } = body

    if (!Array.isArray(familyMemberIds) || familyMemberIds.length === 0) {
      return NextResponse.json(
        { error: "Au moins un membre de la famille doit être sélectionné" },
        { status: 400 }
      )
    }

    const result = await runSmartFilter({
      userId: session.user.id,
      familyMemberIds,
      mediaType: body.mediaType ?? "MOVIE",
      limit: body.limit ?? 20,
      offset: body.offset ?? 0,
      strictMode: body.strictMode ?? false,
      minScore: body.minScore ?? 60,
      genres: body.genres ?? [],
      platforms: body.platforms ?? [],
      topics: body.topics ?? [],
      search: body.search ?? "",
      requirePoster: body.requirePoster ?? false,
      language: body.language ?? "",
      minAge: body.minAge,
      maxAge: body.maxAge,
    })

    if (!result) {
      return NextResponse.json({ error: "Membres non trouvés" }, { status: 404 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Smart filter error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
