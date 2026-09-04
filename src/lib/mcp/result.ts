import { z } from "zod"

const score = z.number().int().min(0).max(5)
export const mediaMatchSchema = z.object({
  id: z.string(), title: z.string(), type: z.enum(["MOVIE", "TV", "GAME", "BOOK", "APP", "MANGA"]),
  year: z.number().int().nullable(), age: z.number().int().nullable(), provisional: z.boolean(), url: z.string().url(),
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
export interface ToolResponse { text: string; data: ToolOutput }

export function toolError(status: "invalid_input" | "unavailable", message: string): ToolResponse {
  return { text: message, data: { schemaVersion: 1, status, result: { kind: "error", message } } }
}

// Bounded operational fields only: no title queries, family information,
// IPs or client-supplied labels. Aggregate logs by tool and outcome.
export async function executeTool(name: "search_media" | "get_age_verdict" | "recommend_for_age", run: () => Promise<ToolResponse>) {
  const started = Date.now()
  let response: ToolResponse
  try {
    response = await run()
    toolOutputSchema.parse(response.data)
  } catch {
    response = toolError("unavailable", "Le catalogue est temporairement indisponible. Réessayez dans un instant ; cette erreur ne signifie pas que le titre est absent.")
  }
  console.info(JSON.stringify({ event: "mcp_tool_call", tool: name, status: response.data.status, durationMs: Date.now() - started }))
  return {
    content: [
      { type: "text" as const, text: response.text },
      { type: "text" as const, text: JSON.stringify(response.data) },
    ],
    structuredContent: response.data,
    isError: response.data.status === "invalid_input" || response.data.status === "unavailable" || response.data.status === "not_found",
  }
}
