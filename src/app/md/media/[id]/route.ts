import { toMediaRouteId } from "@/lib/media-route"
import { renderMediaMarkdown } from "@/lib/markdown/media-md"
import { loadMediaMdInput } from "@/lib/markdown/media-md-data"
import { markdownUnavailable } from "@/lib/markdown/http"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 3600

interface RouteParams {
  params: Promise<{ id: string }>
}

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
    },
  })
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  let input
  try {
    // Lookup + public-visibility gate shared with the MCP get_age_verdict
    // tool (single source: @/lib/markdown/media-md-data).
    input = await loadMediaMdInput(id)
  } catch (error) {
    console.error("[md/media] DB query failed:", error instanceof Error ? error.message : error)
    return markdownUnavailable()
  }

  if (!input) return notFoundResponse()

  const body = renderMediaMarkdown(input)
  const canonicalRouteId = toMediaRouteId(input.type, input.id)
  const canonical = `${baseUrl}/media/${canonicalRouteId}`

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Link": `<${canonical}>; rel="canonical"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
