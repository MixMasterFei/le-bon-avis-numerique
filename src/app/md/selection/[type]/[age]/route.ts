import { buildSelectionMarkdown } from "@/lib/markdown/selection-md"

export const revalidate = 3600

// Markdown recommendation lists for AI agents — the other half of parent
// prompts. /md/media answers "ce titre convient-il à N ans ?"; this layer
// answers "recommande-moi un film/une série/un jeu pour un enfant de N ans".
// Rendering shared with the MCP recommend_for_age tool via
// @/lib/markdown/selection-md (same curated queries as the browse pages:
// enriched-only, quality-sorted — no parallel editorial, no drift).

interface RouteParams {
  params: Promise<{ type: string; age: string }>
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
  const { type, age: ageParam } = await params

  const age = parseInt(ageParam, 10)
  if (Number.isNaN(age) || String(age) !== ageParam) return notFoundResponse()

  let selection
  try {
    selection = await buildSelectionMarkdown(type, age)
  } catch (error) {
    console.error("[md/selection] query failed:", error instanceof Error ? error.message : error)
    return notFoundResponse()
  }
  if (!selection) return notFoundResponse()

  return new Response(selection.body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Link": `<${selection.htmlUrl}>; rel="canonical"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
