import { modelMessageSchema, type ModelMessage, type ToolResultPart } from "ai"

/**
 * Trusted conversation history for /api/totem/chat (F07).
 *
 * The browser used to send the whole conversation, tool outputs included, and
 * the route fed it to the model after a text-only size check: a forged
 * 100,000-character tool result went straight into the prompt, a `system`
 * message from the client became a system instruction, and the model-routing
 * decision counted parts the client could invent.
 *
 * Now the history is rebuilt on the server from totem_messages — the rows the
 * route itself wrote. The client only contributes the new user message and
 * the outcome of the action cards it resolved (see chat-request.ts), both
 * validated. The evaluation bench builds its history with the same function
 * from rows it keeps in memory.
 */

/** Keep at most this many trailing exchanges (user turn + its answer). */
export const TOTEM_HISTORY_MAX_EXCHANGES = 6

/**
 * Budget for the serialized history (text, tool calls AND tool outputs) that
 * reaches the model, new user message included. ~12k tokens; oldest
 * exchanges are dropped first.
 */
export const TOTEM_HISTORY_MAX_CHARS = 48_000

/** Hard reject (413) above this raw `messages` array length. */
export const TOTEM_BODY_MAX_MESSAGES = 60

/** Tools resolved in the browser (action cards); every other tool runs on the server. */
export const CLIENT_TOOL_NAMES = ["proposeNavigation", "proposeAddToWatchlist", "proposeReaction"] as const
export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number]

export function isClientToolName(name: string): name is ClientToolName {
  return (CLIENT_TOOL_NAMES as readonly string[]).includes(name)
}

/** The browser's verdict on one action card, already validated. */
export interface ClientToolOutcome {
  toolCallId: string
  toolName: ClientToolName
  output: Record<string, unknown>
}

/** The totem_messages columns the history is rebuilt from. */
export interface StoredTurnRow {
  role: string
  content: string
  modelMessages?: unknown
  toolCalls?: unknown
  /** On a user row, "regenerate" marks a « Réessayer » re-send. */
  finishReason?: string | null
}

export interface TrustedHistory {
  /** History + the new user message, ready for the model. */
  messages: ModelMessage[]
  /** Tool calls of the previous assistant turn (model-router input). */
  lastTurnToolCount: number
  exchangesKept: number
  exchangesDropped: number
  /** Action cards answered on the server because the parent never clicked. */
  unansweredCards: number
}

/** What the model is told when a parent typed on without using a card. */
export const NO_RESPONSE_OUTCOME = { accepted: false, reason: "no_response" } as const

function parseStoredModelMessages(raw: unknown): ModelMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: ModelMessage[] = []
  for (const item of raw) {
    const parsed = modelMessageSchema.safeParse(item)
    if (!parsed.success) return null
    if (parsed.data.role !== "assistant" && parsed.data.role !== "tool") return null
    out.push(parsed.data)
  }
  return out
}

function countToolCalls(row: StoredTurnRow): number {
  const messages = parseStoredModelMessages(row.modelMessages)
  if (messages) {
    let n = 0
    for (const m of messages) {
      if (m.role === "assistant" && Array.isArray(m.content)) {
        n += m.content.filter((p) => p.type === "tool-call").length
      }
    }
    return n
  }
  return Array.isArray(row.toolCalls) ? row.toolCalls.length : 0
}

/**
 * One persisted assistant row → model messages. Tool calls left without a
 * result (an action card the parent ignored, then typed on) get one appended
 * — the browser's outcome when it sent one, else NO_RESPONSE_OUTCOME — so the
 * prompt stays valid. Results are only ever APPENDED, never removed: editing
 * an earlier assistant turn would invalidate preserved thinking blocks on the
 * models that use them.
 */
function assistantRowToMessages(
  row: StoredTurnRow,
  outcomes: ReadonlyMap<string, ClientToolOutcome>,
  stats: { unansweredCards: number },
): ModelMessage[] {
  const stored = parseStoredModelMessages(row.modelMessages)
  if (!stored) {
    // Rows written before model_messages existed, or a turn interrupted
    // before its first step completed: the visible text is all there is.
    return row.content.trim().length > 0
      ? [{ role: "assistant", content: [{ type: "text", text: row.content }] }]
      : []
  }

  const answered = new Set<string>()
  for (const m of stored) {
    if (m.role === "tool") for (const p of m.content) if (p.type === "tool-result") answered.add(p.toolCallId)
  }

  const out: ModelMessage[] = []
  for (let i = 0; i < stored.length; i++) {
    const message = stored[i]
    out.push(message)
    if (message.role !== "assistant" || typeof message.content === "string") continue

    const pending = message.content.filter(
      (p): p is Extract<typeof p, { type: "tool-call" }> =>
        p.type === "tool-call" && !p.providerExecuted && !answered.has(p.toolCallId),
    )
    if (pending.length === 0) continue

    const results: ToolResultPart[] = pending.map((call) => {
      answered.add(call.toolCallId)
      if (isClientToolName(call.toolName)) {
        const outcome = outcomes.get(call.toolCallId)
        if (!outcome || outcome.toolName !== call.toolName) stats.unansweredCards++
        return {
          type: "tool-result",
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: {
            type: "json",
            value:
              outcome && outcome.toolName === call.toolName
                ? (outcome.output as never)
                : { ...NO_RESPONSE_OUTCOME },
          },
        }
      }
      // A server tool without a result cannot come out of a completed step;
      // answer it rather than leave the prompt unbuildable.
      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: { type: "error-text", value: "Résultat indisponible." },
      }
    })

    const next = stored[i + 1]
    if (next?.role === "tool") {
      stored[i + 1] = { ...next, content: [...next.content, ...results] }
    } else {
      out.push({ role: "tool", content: results })
    }
  }
  return out
}

/**
 * Rebuilds the bounded model history from stored rows (oldest first, read
 * BEFORE the new user message is written) and appends the new user message.
 *
 * `regenerate-message` (the « Réessayer » button) drops the last exchange:
 * the browser removed that answer and re-sends the same question.
 */
export function buildTrustedHistory(opts: {
  rows: ReadonlyArray<StoredTurnRow>
  userText: string
  trigger?: "submit-message" | "regenerate-message"
  outcomes?: ReadonlyMap<string, ClientToolOutcome>
  maxExchanges?: number
  maxChars?: number
}): TrustedHistory {
  const maxExchanges = opts.maxExchanges ?? TOTEM_HISTORY_MAX_EXCHANGES
  const maxChars = opts.maxChars ?? TOTEM_HISTORY_MAX_CHARS
  const outcomes = opts.outcomes ?? new Map<string, ClientToolOutcome>()

  let rows = [...opts.rows]
  if (opts.trigger === "regenerate-message") {
    let lastUser = -1
    rows.forEach((r, i) => {
      if (r.role === "user") lastUser = i
    })
    if (lastUser >= 0) rows = rows.slice(0, lastUser)
  }

  const lastAssistant = [...rows].reverse().find((r) => r.role === "assistant")
  const lastTurnToolCount = lastAssistant ? countToolCalls(lastAssistant) : 0

  const stats = { unansweredCards: 0 }
  const exchanges: ModelMessage[][] = []
  let current: ModelMessage[] | null = null
  for (const row of rows) {
    if (row.role === "user") {
      // A « Réessayer » re-send supersedes the exchange before it (failed or
      // not), exactly as the browser dropped it from its own copy.
      if (row.finishReason === "regenerate") exchanges.pop()
      current = [{ role: "user", content: [{ type: "text", text: row.content }] }]
      exchanges.push(current)
    } else if (row.role === "assistant" && current) {
      current.push(...assistantRowToMessages(row, outcomes, stats))
    }
    // Anything else (an assistant row before any user row) is dropped.
  }

  const finalUser: ModelMessage = { role: "user", content: [{ type: "text", text: opts.userText }] }
  let kept = exchanges.slice(-maxExchanges)
  const size = (messages: ModelMessage[]) => JSON.stringify(messages).length
  const finalSize = size([finalUser])
  while (kept.length > 0 && size(kept.flat()) + finalSize > maxChars) kept = kept.slice(1)

  return {
    messages: [...kept.flat(), finalUser],
    lastTurnToolCount,
    exchangesKept: kept.length,
    exchangesDropped: exchanges.length - kept.length,
    unansweredCards: stats.unansweredCards,
  }
}
