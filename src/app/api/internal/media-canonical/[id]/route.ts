import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Internal Route Handler that looks up media type and returns HTTP 301 redirect.
 * Called via middleware rewrite (not fetch) to avoid Deployment Protection issues.
 * 
 * Pattern: middleware rewrites /media/{uuid} → /api/internal/media-canonical/{uuid}
 * This handler returns 301 redirect to /media/{type}:{uuid}
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // UUID v4 pattern (case-insensitive)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!UUID_REGEX.test(id)) {
    // Not a valid UUID, return 404
    return new NextResponse("Not Found", { status: 404 })
  }

  try {
    const media = await prisma.mediaItem.findUnique({
      where: { id },
      select: { type: true },
    })

    if (!media) {
      // Media not found, return 404
      return new NextResponse("Not Found", { status: 404 })
    }

    // Build canonical URL and return 301 redirect
    const canonicalPath = `/media/${media.type.toLowerCase()}:${id}`
    const url = new URL(request.url)
    url.pathname = canonicalPath
    
    return NextResponse.redirect(url, { status: 301 })
  } catch {
    // DB error, return 500
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
