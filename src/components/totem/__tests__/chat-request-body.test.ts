import { describe, expect, it, vi } from "vitest"
import type { UIMessage } from "ai"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { buildChatRequestBody } from "../useTotemChat"
import { parseChatRequest, TOTEM_BODY_MAX_BYTES } from "@/lib/totem/chat-request"

/** A long conversation as useChat holds it, tool outputs included. */
function longConversation(turns: number): UIMessage[] {
  const messages: UIMessage[] = []
  for (let i = 0; i < turns; i++) {
    messages.push({ id: `u${i}`, role: "user", parts: [{ type: "text", text: `Question ${i}` }] })
    messages.push({
      id: `a${i}`,
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-searchMedia",
          toolCallId: `s${i}`,
          state: "output-available",
          input: { q: "x" },
          output: { results: Array.from({ length: 5 }, (_, k) => ({ id: `m${k}`, shortPitch: "y".repeat(220) })) },
        },
        { type: "text", text: "Réponse ".repeat(40) },
        {
          type: "tool-proposeNavigation",
          toolCallId: `n${i}`,
          state: i % 2 === 0 ? "output-available" : "input-available",
          input: { path: "/films", label: "Films", reason: "Voir" },
          ...(i % 2 === 0 ? { output: { accepted: false, reason: "user_declined" } } : {}),
        },
      ],
    } as UIMessage)
  }
  messages.push({ id: "last", role: "user", parts: [{ type: "text", text: "Et pour Hugo ?" }] })
  return messages
}

describe("the browser's chat request (compact contract)", () => {
  it("sends only the new message and the answered cards, whatever the conversation length", () => {
    const body = buildChatRequestBody(longConversation(19), { conversationId: "c-1", sourcePage: "/films" }, "submit-message")
    expect(body.messages).toEqual([{ id: "last", role: "user", parts: [{ type: "text", text: "Et pour Hugo ?" }] }])
    expect(body.toolOutcomes.every((o) => o.toolName === "proposeNavigation")).toBe(true)
    expect(body.toolOutcomes.length).toBeLessThanOrEqual(20)
    const raw = JSON.stringify(body)
    expect(raw.length).toBeLessThan(TOTEM_BODY_MAX_BYTES / 4)
    // …and it is exactly what the server accepts.
    const parsed = parseChatRequest(raw)
    expect(parsed.ok).toBe(true)
  })

  it("carries the regenerate trigger and never a server tool's output", () => {
    const body = buildChatRequestBody(longConversation(2), {}, "regenerate-message")
    expect(body.trigger).toBe("regenerate-message")
    expect(JSON.stringify(body)).not.toContain("shortPitch")
  })
})
