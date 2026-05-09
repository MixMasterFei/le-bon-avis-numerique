"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Send, Loader2, X, ChevronLeft, History, Plus, Zap, ZapOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTotemChat } from "./useTotemChat"
import { TotemMessage } from "./TotemMessage"
import { TotemEmpty } from "./TotemEmpty"
import { TotemError } from "./TotemError"
import { TotemRateLimit } from "./TotemRateLimit"
import { TotemAlphaBadge } from "./TotemAlphaBadge"
import { TotemHistoryPanel } from "./TotemHistoryPanel"

const ALPHA_HINT_KEY = "totem.alphaHintDismissed.v1"
const AUTO_MODE_KEY = "totem.autoMode.v1"
const MAX_INPUT_CHARS = 1500

export interface TotemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TotemSheet({ open, onOpenChange }: TotemSheetProps) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const pathname = usePathname()

  const [draft, setDraft] = useState("")
  // Read once from localStorage at mount (lazy init — avoids
  // setState-in-effect lint and works because TotemDock is loaded
  // with ssr:false so the component never renders server-side).
  const [showAlphaHint, setShowAlphaHint] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return !window.localStorage.getItem(ALPHA_HINT_KEY)
  })
  const [view, setView] = useState<"chat" | "history">("chat")
  const [autoMode, setAutoMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(AUTO_MODE_KEY) === "1"
  })
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const {
    messages,
    status,
    error,
    rateLimit,
    loading,
    activeConversationId,
    sendUserMessage,
    acceptNavigation,
    declineNavigation,
    acceptWatchlist,
    declineWatchlist,
    acceptReaction,
    declineReaction,
    resetConversation,
    loadConversation,
    sendFeedback,
  } = useTotemChat({ sourcePage: pathname })

  const toggleAutoMode = () => {
    setAutoMode((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        if (next) window.localStorage.setItem(AUTO_MODE_KEY, "1")
        else window.localStorage.removeItem(AUTO_MODE_KEY)
      }
      return next
    })
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Pre-fill prompt dispatched from TotemHeroEntry chips
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail
      if (detail?.prompt) {
        // Defer slightly so the sheet is mounted before sending
        setTimeout(() => sendUserMessage(detail.prompt!), 120)
      }
    }
    window.addEventListener("totem:prefill", handler)
    return () => window.removeEventListener("totem:prefill", handler)
  }, [sendUserMessage])

  useEffect(() => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages.length, status])

  const dismissAlphaHint = () => {
    setShowAlphaHint(false)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ALPHA_HINT_KEY, "1")
    }
  }

  const isStreaming = status === "submitted" || status === "streaming"

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isStreaming) return
    sendUserMessage(trimmed)
    setDraft("")
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePickPrompt = (text: string) => {
    if (isStreaming) return
    sendUserMessage(text)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col shadow-2xl",
            "sm:w-[440px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "duration-200",
          )}
          style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Totem — assistant familial</DialogPrimitive.Title>

          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--color-line)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              {view === "history" && (
                <button
                  type="button"
                  onClick={() => setView("chat")}
                  className="rounded-md p-1.5 transition hover:bg-black/5"
                  style={{ color: "var(--color-ink2)" }}
                  aria-label="Retour à la conversation"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg font-medium"
                    style={{ fontFamily: "var(--font-fraunces)", letterSpacing: "-0.01em" }}
                  >
                    {view === "history" ? "Historique" : "Totem"}
                  </span>
                  {view === "chat" && <TotemAlphaBadge variant="full" />}
                </div>
                {view === "chat" && (
                  <p className="text-[11px]" style={{ color: "var(--color-ink2)" }}>
                    Le guide indépendant des familles.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAuthenticated && view === "chat" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetConversation()
                      setDraft("")
                      setTimeout(() => inputRef.current?.focus(), 50)
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition hover:bg-black/5"
                    style={{ color: "var(--color-ink)" }}
                    aria-label="Nouvelle conversation"
                    title="Nouvelle conversation"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Nouvelle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("history")}
                    className="rounded-md p-1.5 transition hover:bg-black/5"
                    style={{ color: "var(--color-ink2)" }}
                    aria-label="Historique"
                    title="Historique"
                  >
                    <History className="h-4 w-4" />
                  </button>
                </>
              )}
              <DialogPrimitive.Close
                className="rounded-md p-1.5 transition hover:bg-black/5"
                style={{ color: "var(--color-ink2)" }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Alpha hint banner — first open only */}
          {showAlphaHint && (
            <div className="flex items-start justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              <span>Je débute — vos remarques sont précieuses.</span>
              <button
                type="button"
                onClick={dismissAlphaHint}
                className="text-amber-700 hover:text-amber-900"
                aria-label="Fermer le rappel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Conversation OR history */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto">
            {view === "history" ? (
              <TotemHistoryPanel
                activeConversationId={activeConversationId}
                onPick={async (id) => {
                  const ok = await loadConversation(id)
                  if (ok) setView("chat")
                }}
                onDeleted={(id) => {
                  // If the user deleted the conversation they're
                  // currently in, drop back to a fresh chat.
                  if (id === activeConversationId) {
                    resetConversation()
                  }
                }}
                onClose={() => setView("chat")}
              />
            ) : loading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm" style={{ color: "var(--color-ink2)" }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement de la conversation…
              </div>
            ) : (
              <div className="px-3 py-3">
                {messages.length === 0 ? (
                  <TotemEmpty
                    sourcePage={pathname}
                    isAuthenticated={isAuthenticated}
                    onPickPrompt={handlePickPrompt}
                  />
                ) : (
              <div className="space-y-3">
                {messages.map((m, idx) => {
                  const isLast = idx === messages.length - 1
                  return (
                    <TotemMessage
                      key={m.id}
                      message={m}
                      onAcceptNavigation={(toolCallId, path) => {
                        acceptNavigation(toolCallId, path)
                        onOpenChange(false)
                      }}
                      onDeclineNavigation={declineNavigation}
                      onAcceptWatchlist={acceptWatchlist}
                      onDeclineWatchlist={declineWatchlist}
                      onAcceptReaction={acceptReaction}
                      onDeclineReaction={declineReaction}
                      onSendFeedback={sendFeedback}
                      autoMode={autoMode}
                      isStreaming={isLast && isStreaming}
                    />
                  )
                })}
                {isStreaming && (
                  <div className="flex items-center gap-2 px-3 py-1 text-xs text-neutral-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Totem rédige…
                  </div>
                )}
                {error && !rateLimit && (
                  <TotemError onRetry={() => handleSubmit()} />
                )}
                {rateLimit && (
                  <TotemRateLimit
                    retryAfterSec={rateLimit.retryAfterSec}
                    isAuthenticated={isAuthenticated}
                  />
                )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-mode toggle — visible in chat view, sits just above composer */}
          {view === "chat" && (
            <div
              className="flex items-center justify-between border-t px-3 py-2 text-[11px]"
              style={{ borderColor: "var(--color-line)", background: "var(--color-bg2)", color: "var(--color-ink2)" }}
            >
              <button
                type="button"
                onClick={toggleAutoMode}
                aria-pressed={autoMode}
                title={
                  autoMode
                    ? "Mode auto activé : Totem peut vous emmener directement vers une page sans demander."
                    : "Mode auto désactivé : Totem demande toujours avant de naviguer."
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition",
                  autoMode
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "hover:bg-black/5",
                )}
              >
                {autoMode ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
                <span className="font-medium">Mode auto</span>
                <span className="opacity-70">{autoMode ? "activé" : "désactivé"}</span>
              </button>
              <span className="hidden sm:inline italic opacity-70">
                {autoMode ? "Totem agit sans demander." : "Totem demande avant chaque action."}
              </span>
            </div>
          )}

          {/* Composer — hidden in history view */}
          {view === "chat" && (
          <form
            onSubmit={handleSubmit}
            className="border-t px-3 py-3"
            style={{ borderColor: "var(--color-line)", background: "var(--color-card)" }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT_CHARS))}
                onKeyDown={handleKey}
                placeholder="Posez votre question…"
                disabled={isStreaming || !!rateLimit}
                rows={1}
                className={cn(
                  "min-h-[40px] flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm",
                  "focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]",
                  "disabled:bg-neutral-50 disabled:text-neutral-400",
                )}
                maxLength={MAX_INPUT_CHARS}
              />
              <button
                type="submit"
                disabled={!draft.trim() || isStreaming || !!rateLimit}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg",
                  "bg-[var(--color-accent)] text-white shadow-sm transition",
                  "hover:bg-[var(--color-accent)]/90 disabled:bg-neutral-300",
                )}
                aria-label="Envoyer"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            {draft.length > 1200 && (
              <div className="mt-1 text-[10px] text-neutral-400">
                {draft.length} / {MAX_INPUT_CHARS}
              </div>
            )}
          </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
