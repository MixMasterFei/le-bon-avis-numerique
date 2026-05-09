"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { isPathAllowed } from "@/lib/totem/nav-allowlist"

interface PersistedMessage {
  id: string
  role: string
  content: string
  createdAt: string
}

function persistedToUIMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
    parts: [{ type: "text" as const, text: m.content }],
  }))
}

const CONVERSATION_KEY = "totem.conversationId.v1"

function readStoredConversationId(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    return window.sessionStorage.getItem(CONVERSATION_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function writeStoredConversationId(id: string | undefined) {
  if (typeof window === "undefined") return
  try {
    if (id) window.sessionStorage.setItem(CONVERSATION_KEY, id)
    else window.sessionStorage.removeItem(CONVERSATION_KEY)
  } catch {
    /* ignore */
  }
}

export interface NavigationProposal {
  toolCallId: string
  path: string
  label: string
  reason: string
  resolved?: { accepted: boolean }
}

export interface UseTotemChatOptions {
  sourcePage?: string | null
}

export function useTotemChat(opts: UseTotemChatOptions = {}) {
  const router = useRouter()
  const conversationIdRef = useRef<string | undefined>(readStoredConversationId())
  const [rateLimit, setRateLimit] = useState<{ retryAfterSec: number } | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/totem/chat",
        credentials: "same-origin",
        body: () => ({
          conversationId: conversationIdRef.current,
          sourcePage: opts.sourcePage ?? (typeof window !== "undefined" ? window.location.pathname : null),
        }),
        fetch: async (input, init) => {
          const res = await fetch(input, init)
          // Capture conversationId from response header for next turn
          const cid = res.headers.get("x-totem-conversation-id")
          if (cid) {
            conversationIdRef.current = cid
            writeStoredConversationId(cid)
          }
          if (res.status === 429) {
            try {
              const data = (await res.clone().json()) as { retryAfterSec?: number }
              setRateLimit({ retryAfterSec: data.retryAfterSec ?? 60 })
            } catch {
              setRateLimit({ retryAfterSec: 60 })
            }
          }
          return res
        },
      }),
    [opts.sourcePage],
  )

  const chat = useChat({
    transport,
    onToolCall: async ({ toolCall }) => {
      // proposeNavigation is the only client-resolved tool in Phase 1.
      // Returning here would auto-resolve; instead we leave it pending so
      // the UI can render <TotemActionCard> with explicit buttons.
      if (toolCall.toolName === "proposeNavigation") {
        return // surface to UI; user clicks confirm/decline
      }
    },
    onError: (err) => {
      console.error("[totem] chat error", err)
    },
  })

  const sendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setRateLimit(null)
      void chat.sendMessage({ text: trimmed })
    },
    [chat],
  )

  const acceptNavigation = useCallback(
    (toolCallId: string, path: string) => {
      const safe = isPathAllowed(path)
      void chat.addToolResult({
        tool: "proposeNavigation",
        toolCallId,
        output: { accepted: safe, reason: safe ? "user_confirmed" : "path_not_allowed" },
      })
      if (safe) {
        router.push(path)
      }
    },
    [chat, router],
  )

  const declineNavigation = useCallback(
    (toolCallId: string) => {
      void chat.addToolResult({
        tool: "proposeNavigation",
        toolCallId,
        output: { accepted: false, reason: "user_declined" },
      })
    },
    [chat],
  )

  const resetConversation = useCallback(() => {
    conversationIdRef.current = undefined
    writeStoredConversationId(undefined)
    chat.setMessages([])
    setRateLimit(null)
  }, [chat])

  const [loading, setLoading] = useState(false)

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setLoading(true)
      setRateLimit(null)
      try {
        const res = await fetch(`/api/totem/conversations/${encodeURIComponent(conversationId)}`, {
          credentials: "same-origin",
          cache: "no-store",
        })
        if (!res.ok) {
          console.error("[totem] loadConversation failed", res.status)
          return false
        }
        const data = (await res.json()) as { id: string; messages: PersistedMessage[] }
        conversationIdRef.current = data.id
        writeStoredConversationId(data.id)
        chat.setMessages(persistedToUIMessages(data.messages))
        return true
      } catch (err) {
        console.error("[totem] loadConversation error", err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [chat],
  )

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    rateLimit,
    loading,
    activeConversationId: conversationIdRef.current,
    sendUserMessage,
    acceptNavigation,
    declineNavigation,
    resetConversation,
    loadConversation,
    stop: chat.stop,
  }
}
