import { z } from "zod"
import {
  CLIENT_TOOL_NAMES,
  isClientToolName,
  TOTEM_BODY_MAX_MESSAGES,
  type ClientToolName,
  type ClientToolOutcome,
} from "./history"

/**
 * Validation of the POST /api/totem/chat body (F07 + review #2). Runs before
 * any auth, quota, database or model work; everything the client sends is
 * treated as hostile until it has passed here.
 *
 * Contract (sent by useTotemChat since 2026-11):
 *   { conversationId?, sourcePage?, trigger?, messages: [<new user message>],
 *     toolOutcomes?: [{ toolCallId, toolName, output }] }
 *
 * Older browser tabs still post the whole conversation in `messages`. It is
 * accepted only if it passes the same rules — roles and part types
 * whitelisted, no `system` message, no server-tool output — and only the last
 * user message and the action-card outcomes are read from it: the history the
 * model sees is rebuilt on the server (history.ts).
 */

/** Raw request body cap. The compact contract weighs well under 2 KB. */
export const TOTEM_BODY_MAX_BYTES = 32 * 1024
/** Per user message (the new one and any older one an old tab re-sends). */
export const TOTEM_MAX_INPUT_CHARS = 1500

const MAX_PARTS_PER_MESSAGE = 64
const MAX_ASSISTANT_TEXT_CHARS = 20_000
const MAX_TOOL_OUTCOMES = 20
const MAX_ID_CHARS = 128

/** Every tool Totem exposes; a tool part naming anything else is forged. */
export const TOTEM_TOOL_NAMES = [
  "searchMedia",
  "getMediaDetails",
  "getCommunityConsensus",
  "getFamilyFit",
  "getDiscoveryRail",
  "searchBlog",
  "searchNews",
  "getUserFamilyContext",
  ...CLIENT_TOOL_NAMES,
] as const

const TOOL_PART_STATES = new Set([
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
  "approval-requested",
  "approval-responded",
  "output-denied",
])

// Exactly what useTotemChat writes for each card (see its add*Result calls).
const OUTCOME_SCHEMAS: Record<ClientToolName, z.ZodType<Record<string, unknown>>> = {
  proposeNavigation: z
    .object({
      accepted: z.boolean(),
      reason: z.enum(["user_confirmed", "user_declined", "path_not_allowed"]).optional(),
    })
    .strict(),
  proposeAddToWatchlist: z
    .object({
      accepted: z.boolean(),
      alreadyPresent: z.boolean().optional(),
      reason: z.enum(["user_declined", "request_failed", "request_error"]).optional(),
    })
    .strict(),
  proposeReaction: z
    .object({
      accepted: z.boolean(),
      reason: z
        .string()
        .regex(/^(user_declined|request_error|status_\d{3})$/)
        .optional(),
    })
    .strict(),
}

export type ChatTrigger = "submit-message" | "regenerate-message"

export interface ParsedChatRequest {
  userText: string
  /** The new user message as the browser sent it (id + text only). */
  userMessage: { id: string; role: "user"; parts: Array<{ type: "text"; text: string }> }
  conversationId: string | null
  /** An allowed internal path, or null (unknown / refused). */
  sourcePage: string | null
  trigger: ChatTrigger
  toolOutcomes: Map<string, ClientToolOutcome>
}

export interface ChatRequestError {
  status: 400 | 413
  error: string
  limit?: number
}

type Result = { ok: true; value: ParsedChatRequest } | { ok: false; error: ChatRequestError }

const fail = (status: 400 | 413, error: string, limit?: number): Result => ({
  ok: false,
  error: limit != null ? { status, error, limit } : { status, error },
})

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

// ---------------------------------------------------------------------------
// sourcePage — interpolated into the system prompt, so only a plain internal
// path from a known section of the site gets through. Anything else becomes
// null (« page inconnue »): the page context is enrichment, not a reason to
// refuse a parent's question.
// ---------------------------------------------------------------------------

const PAGE_ROOTS = new Set([
  "",
  "films",
  "series",
  "jeux",
  "livres",
  "mangas",
  "media",
  "recherche",
  "decouverte",
  "tableau",
  "blog",
  "apercudecouverte",
  "apercudecouverte-v3",
  "apercudecouverte-v4",
  "apercudecouverte-v5",
  "apercufilm",
  "apercufoyer",
  "apercuhomepage",
  "profil",
  "chez-vous",
  "coin-famille",
  "collections",
  "guides",
  "age",
  "recommandations",
  "ma-liste",
  "mes-favoris",
  "a-propos",
  "notre-methode",
  "nos-valeurs",
  "objectif",
  "contact",
  "confidentialite",
  "cookies",
  "mentions-legales",
  "steph",
  "connexion",
  "inscription",
])

const SOURCE_PAGE_MAX_CHARS = 160
// Letters (accented included), digits and - . _ ~ : / — no spaces, quotes,
// backticks, markdown or control characters, once percent-decoded.
const SOURCE_PAGE_CHARSET = /^\/[\p{L}\p{N}\-._~:/]*$/u

export function sanitizeSourcePage(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const path = raw.split(/[?#]/)[0]
  if (path.length === 0 || path.length > SOURCE_PAGE_MAX_CHARS) return null
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("//")) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }
  if (!SOURCE_PAGE_CHARSET.test(decoded) || /[%]/.test(path.replace(/%[0-9A-Fa-f]{2}/g, ""))) return null
  const root = decoded.split("/")[1] ?? ""
  if (!PAGE_ROOTS.has(root)) return null
  return path
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function validateMessage(
  m: unknown,
  toolOutcomes: Map<string, ClientToolOutcome>,
): { ok: true; role: "user" | "assistant"; text: string; id: string } | { ok: false; error: Result } {
  if (!isRecord(m)) return { ok: false, error: fail(400, "invalid_message") }
  // Only the two conversational roles: a client-supplied `system` message
  // would otherwise become a system instruction.
  if (m.role !== "user" && m.role !== "assistant") return { ok: false, error: fail(400, "invalid_role") }
  const id = typeof m.id === "string" ? m.id : ""
  if (id.length > MAX_ID_CHARS) return { ok: false, error: fail(400, "invalid_message") }
  if (!Array.isArray(m.parts) || m.parts.length > MAX_PARTS_PER_MESSAGE) {
    return { ok: false, error: fail(400, "invalid_message") }
  }

  const texts: string[] = []
  for (const part of m.parts) {
    if (!isRecord(part) || typeof part.type !== "string") return { ok: false, error: fail(400, "invalid_part") }

    if (part.type === "text") {
      if (typeof part.text !== "string") return { ok: false, error: fail(400, "invalid_part") }
      texts.push(part.text)
      continue
    }
    // User messages are plain text — no files, data or tool parts.
    if (m.role === "user") return { ok: false, error: fail(400, "invalid_part") }

    if (part.type === "step-start") continue
    if (part.type === "reasoning") {
      if (typeof part.text !== "string") return { ok: false, error: fail(400, "invalid_part") }
      continue
    }
    if (!part.type.startsWith("tool-")) return { ok: false, error: fail(400, "invalid_part") }

    const toolName = part.type.slice("tool-".length)
    if (!(TOTEM_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return { ok: false, error: fail(400, "invalid_part") }
    }
    if (
      typeof part.toolCallId !== "string" ||
      part.toolCallId.length === 0 ||
      part.toolCallId.length > MAX_ID_CHARS ||
      typeof part.state !== "string" ||
      !TOOL_PART_STATES.has(part.state)
    ) {
      return { ok: false, error: fail(400, "invalid_part") }
    }
    const carriesOutput = "output" in part || "errorText" in part
    if (!isClientToolName(toolName)) {
      // Server tools run on the server; their results are never taken from
      // the client (the 100,000-character forged result of the F07 report).
      if (carriesOutput) return { ok: false, error: fail(400, "forged_tool_output") }
      continue
    }
    if (part.state === "output-available") {
      const parsed = OUTCOME_SCHEMAS[toolName].safeParse(part.output)
      if (!parsed.success) return { ok: false, error: fail(400, "invalid_tool_outcome") }
      toolOutcomes.set(part.toolCallId, { toolCallId: part.toolCallId, toolName, output: parsed.data })
    } else if (carriesOutput) {
      return { ok: false, error: fail(400, "invalid_tool_outcome") }
    }
  }

  const text = texts.join("\n")
  if (m.role === "user" && text.trim().length > TOTEM_MAX_INPUT_CHARS) {
    return { ok: false, error: fail(413, "message_too_long", TOTEM_MAX_INPUT_CHARS) }
  }
  if (m.role === "assistant" && text.length > MAX_ASSISTANT_TEXT_CHARS) {
    return { ok: false, error: fail(413, "message_too_long", MAX_ASSISTANT_TEXT_CHARS) }
  }
  return { ok: true, role: m.role, text, id }
}

/**
 * Parses and validates the raw request body. `rawBody` is the exact text the
 * client sent: its size is checked before anything is parsed.
 */
export function parseChatRequest(rawBody: string): Result {
  if (Buffer.byteLength(rawBody, "utf8") > TOTEM_BODY_MAX_BYTES) {
    return fail(413, "body_too_large", TOTEM_BODY_MAX_BYTES)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return fail(400, "invalid_json")
  }
  if (!isRecord(body)) return fail(400, "invalid_json")

  if (!Array.isArray(body.messages) || body.messages.length === 0) return fail(400, "missing_messages")
  if (body.messages.length > TOTEM_BODY_MAX_MESSAGES) return fail(413, "history_too_long")

  let conversationId: string | null = null
  if (body.conversationId != null) {
    if (typeof body.conversationId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.conversationId)) {
      return fail(400, "invalid_conversation_id")
    }
    conversationId = body.conversationId
  }

  let trigger: ChatTrigger = "submit-message"
  if (body.trigger != null) {
    if (body.trigger !== "submit-message" && body.trigger !== "regenerate-message") {
      return fail(400, "invalid_trigger")
    }
    trigger = body.trigger
  }

  const toolOutcomes = new Map<string, ClientToolOutcome>()
  let last: { role: "user" | "assistant"; text: string; id: string } | null = null
  for (const m of body.messages) {
    const checked = validateMessage(m, toolOutcomes)
    if (!checked.ok) return checked.error
    last = checked
  }

  if (body.toolOutcomes != null) {
    if (!Array.isArray(body.toolOutcomes) || body.toolOutcomes.length > MAX_TOOL_OUTCOMES) {
      return fail(400, "invalid_tool_outcome")
    }
    for (const o of body.toolOutcomes) {
      if (
        !isRecord(o) ||
        typeof o.toolCallId !== "string" ||
        o.toolCallId.length === 0 ||
        o.toolCallId.length > MAX_ID_CHARS ||
        typeof o.toolName !== "string" ||
        !isClientToolName(o.toolName)
      ) {
        return fail(400, "invalid_tool_outcome")
      }
      const parsed = OUTCOME_SCHEMAS[o.toolName].safeParse(o.output)
      if (!parsed.success) return fail(400, "invalid_tool_outcome")
      toolOutcomes.set(o.toolCallId, { toolCallId: o.toolCallId, toolName: o.toolName, output: parsed.data })
    }
  }

  // Ordering: the conversation must end on the parent's new message.
  if (!last || last.role !== "user") return fail(400, "no_user_message")
  const userText = last.text.trim()
  if (!userText) return fail(400, "empty_user_message")

  return {
    ok: true,
    value: {
      userText,
      userMessage: { id: last.id, role: "user", parts: [{ type: "text", text: userText }] },
      conversationId,
      sourcePage: sanitizeSourcePage(body.sourcePage),
      trigger,
      toolOutcomes,
    },
  }
}
