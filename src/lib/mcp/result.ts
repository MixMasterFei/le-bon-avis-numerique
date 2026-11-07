import { z } from "zod"
import { scheduleMcpUsage, type McpToolName } from "./usage"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

const score = z.number().int().min(0).max(5)
export const mediaMatchSchema = z.object({
  id: z.string(), title: z.string(), type: z.enum(["MOVIE", "TV", "GAME", "BOOK", "APP", "MANGA"]),
  year: z.number().int().nullable(),
  age: z.number().int().nullable()
    .describe("Âge conseillé Totem Avisé en années. 0 = « Tous publics » (une vraie recommandation, pas une absence d'âge) ; null = âge inconnu ; une valeur provisoire est signalée par `provisional`."),
  provisional: z.boolean(), url: z.string().url(),
})
const assessmentSchema = z.object({
  status: z.enum(["available", "provisional", "unavailable"]), source: z.string().nullable(),
  assessedAt: z.string().nullable(), confidence: z.number().min(0).max(1).nullable(),
  metrics: z.object({ violence: score, sexNudity: score, language: score, substanceUse: score,
    consumerism: score, positiveMessages: score, roleModels: score, educationalValue: score }).nullable(),
  educationalValueMethod: z.literal("derived_from_topics_and_positive_metrics"),
  warningsStatus: z.enum(["automated_points_to_check", "unavailable"]), warnings: z.array(z.string()),
  warningsAssessedAt: z.string().nullable(),
})
export const toolOutputSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["ok", "not_found", "ambiguous", "invalid_input", "unavailable"]),
  result: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("search"), query: z.string(), matches: z.array(mediaMatchSchema) }),
    z.object({ kind: z.literal("verdict"), candidates: z.array(mediaMatchSchema),
      media: mediaMatchSchema.extend({
        updatedAt: z.string(), classification: z.object({ value: z.string().nullable(), country: z.null(), authority: z.null() }),
        assessment: assessmentSchema,
      }).nullable(),
    }),
    z.object({ kind: z.literal("selection"), age: z.number().int(), type: z.enum(["films", "series", "jeux"]),
      url: z.string().url(), items: z.array(mediaMatchSchema) }),
    z.object({ kind: z.literal("error"), message: z.string() }),
  ]),
})
export type ToolOutput = z.infer<typeof toolOutputSchema>
export interface ToolResponse {
  text: string
  data: ToolOutput
  /**
   * Overrides the default, which flags only invalid input and outages as
   * errors. An empty search is a successful answer (« aucun titre »), not a
   * failed call — directory review requires every tool to succeed on valid
   * parameters. An identifier that resolves to nothing sets this to true.
   */
  isError?: boolean
}

export function toolError(status: "invalid_input" | "unavailable", message: string): ToolResponse {
  return { text: message, data: { schemaVersion: 1, status, result: { kind: "error", message } } }
}

const ATTRIBUTION = /Source ?: Totem Avisé/

/**
 * Every answer an assistant can quote credits Totem Avisé and links back:
 * the fiche for a verdict, the selection page for a selection, the site
 * otherwise. Errors carry no attribution (there is nothing to quote). Text
 * that already credits the source (the selection Markdown) is left as is.
 */
export function withAttribution(response: ToolResponse): ToolResponse {
  if (response.data.status === "invalid_input" || response.data.status === "unavailable") return response
  if (ATTRIBUTION.test(response.text)) return response
  const result = response.data.result
  const url = result.kind === "verdict" && result.media ? result.media.url : result.kind === "selection" ? result.url : SITE_URL
  return { ...response, text: `${response.text}\n\nSource : Totem Avisé — ${url}` }
}

// Bounded operational fields only: no title queries, family information,
// IPs or client-supplied labels. Aggregate logs by tool and outcome.
export async function executeTool(
  name: McpToolName,
  run: () => Promise<ToolResponse>,
  context: { userAgent?: string | null } = {},
) {
  const started = Date.now()
  let response: ToolResponse
  try {
    response = withAttribution(await run())
    toolOutputSchema.parse(response.data)
  } catch {
    response = toolError("unavailable", "Le catalogue est temporairement indisponible. Réessayez dans un instant ; cette erreur ne signifie pas que le titre est absent.")
  }
  const isError = response.isError ?? (response.data.status === "invalid_input" || response.data.status === "unavailable")
  console.info(JSON.stringify({ event: "mcp_tool_call", tool: name, status: response.data.status, durationMs: Date.now() - started }))
  // Per-day counters (tool, and which fiche a verdict resolved to). Never the
  // query text or the caller's IP — see ./usage.ts.
  scheduleMcpUsage(name, response.data, isError, context.userAgent)
  return {
    content: [
      { type: "text" as const, text: response.text },
      { type: "text" as const, text: JSON.stringify(response.data) },
    ],
    structuredContent: response.data,
    isError,
  }
}
