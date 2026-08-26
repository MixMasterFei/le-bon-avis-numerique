import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Minimal internal API to get media type by ID.
 * Used by middleware for 301 redirect of unprefixed /media/{id} URLs.
 * Returns { type: "MOVIE" | "TV" | ... } or 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // UUID v4 pattern
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
  }

  try {
    const media = await prisma.mediaItem.findUnique({
      where: { id },
      select: { type: true },
    })

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ type: media.type })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
