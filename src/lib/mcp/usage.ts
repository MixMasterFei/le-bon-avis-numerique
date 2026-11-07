import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { detectAiBot, summarizeUserAgent } from "@/lib/ai-bots"
import type { ToolOutput } from "./result"

/**
 * Privacy-safe usage counter for the MCP connector — is a directory listing
 * paying off? Reuses `ai_bot_hits` (one row per day × bot × kind × surface,
 * `count` incremented), so no table and no migration:
 *
 *   kind     "mcp"  — kept apart from the crawler / referral / sample rows
 *   bot      the calling assistant, reduced to a low-cardinality token
 *            (« Claude-User », « ChatGPT-User »…) — never the raw User-Agent
 *   surface  "mcp-<tool>" counts calls per tool (":erreur" suffix when the
 *            call failed), and "mcp-fiche:<id>" counts, for a verdict that
 *            resolved to a fiche, which title was consulted
 *
 * Never stored: the query text, an IP, anything from the conversation. The
 * write runs after the response (`after`) and can never fail a tool call.
 * Read it with `npx tsx scripts/check-ai-bots.ts` (rows of kind "mcp").
 */

export type McpToolName = "search_media" | "get_age_verdict" | "recommend_for_age"
export const MCP_USAGE_KIND = "mcp"

export interface UsageRow {
  bot: string
  kind: typeof MCP_USAGE_KIND
  surface: string
}

/** Low-cardinality token for the calling client; "inconnu" when no User-Agent. */
export function mcpClientToken(userAgent: string | null | undefined): string {
  if (!userAgent) return "inconnu"
  return detectAiBot(userAgent)?.bot ?? summarizeUserAgent(userAgent)
}

export function mcpUsageRows(
  tool: McpToolName,
  data: ToolOutput,
  isError: boolean,
  userAgent: string | null | undefined,
): UsageRow[] {
  const bot = mcpClientToken(userAgent)
  const rows: UsageRow[] = [{ bot, kind: MCP_USAGE_KIND, surface: `mcp-${tool}${isError ? ":erreur" : ""}` }]
  const result = data.result
  if (tool === "get_age_verdict" && data.status === "ok" && result.kind === "verdict" && result.media) {
    rows.push({ bot, kind: MCP_USAGE_KIND, surface: `mcp-fiche:${result.media.id}` })
  }
  return rows
}

/** Day-bucketed upserts. Swallows every error: telemetry must never break a call. */
export async function recordMcpUsage(rows: UsageRow[]): Promise<void> {
  try {
    const day = new Date(new Date().toISOString().slice(0, 10))
    await Promise.allSettled(
      rows.map((row) =>
        prisma.aiBotHit.upsert({
          where: { day_bot_kind_surface: { day, ...row } },
          create: { day, ...row, count: 1 },
          update: { count: { increment: 1 } },
        }),
      ),
    )
  } catch {
    // table missing on a fresh environment, client unavailable… — ignore
  }
}

/** Count the call once the response has been sent. */
export function scheduleMcpUsage(
  tool: McpToolName,
  data: ToolOutput,
  isError: boolean,
  userAgent: string | null | undefined,
): void {
  const write = recordMcpUsage(mcpUsageRows(tool, data, isError, userAgent))
  try {
    // Keeps the serverless function alive until the write lands.
    after(write)
  } catch {
    // Outside a request scope (unit tests): the write simply runs detached.
  }
}
