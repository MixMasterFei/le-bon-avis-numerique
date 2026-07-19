import type { UIMessage } from "ai"

/**
 * Server-side conversation-history bounds for /api/totem/chat.
 *
 * The chat request's `messages` array comes straight from the client, and
 * only the LAST user message is length-capped by the route — without these
 * bounds a hostile (or just buggy) client could inflate every prior message
 * and multiply input-token cost on each turn. The server, not the client,
 * decides how much history reaches the model.
 */

/** Keep at most this many trailing messages (~6 exchanges; turn cap is 20). */
export const TOTEM_HISTORY_MAX_MESSAGES = 12

/** Total text-part character budget across the kept history. */
export const TOTEM_HISTORY_MAX_CHARS = 16_000

/** Hard reject (413) above this raw array length — nothing legitimate gets close. */
export const TOTEM_BODY_MAX_MESSAGES = 60

function messageTextChars(message: UIMessage): number {
  let total = 0
  for (const part of message.parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") total += part.text.length
  }
  return total
}

/**
 * Bounds the client-supplied history: keeps the most recent
 * TOTEM_HISTORY_MAX_MESSAGES, then walks backwards dropping older messages
 * once TOTEM_HISTORY_MAX_CHARS of text is accumulated. The final message
 * (the new user turn) is always kept regardless of size — the route
 * separately caps its length. After trimming, leading non-user messages are
 * dropped so the array still starts on a user turn (an orphaned assistant
 * or tool message at the head breaks model-message conversion).
 */
export function truncateHistory(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages

  let kept = messages.slice(-TOTEM_HISTORY_MAX_MESSAGES)

  let budget = TOTEM_HISTORY_MAX_CHARS
  let firstKeptIndex = kept.length - 1 // always keep the final message
  budget -= messageTextChars(kept[kept.length - 1])
  for (let i = kept.length - 2; i >= 0; i--) {
    const chars = messageTextChars(kept[i])
    if (chars > budget) break
    budget -= chars
    firstKeptIndex = i
  }
  kept = kept.slice(firstKeptIndex)

  // Re-anchor on a user turn.
  const firstUser = kept.findIndex((m) => m.role === "user")
  if (firstUser > 0) kept = kept.slice(firstUser)

  return kept
}
