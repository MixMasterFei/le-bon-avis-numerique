"use client"

import ReactMarkdown from "react-markdown"
import type { UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { TotemMediaCard, type TotemCitedMedia } from "./TotemMediaCard"
import { TotemActionCard } from "./TotemActionCard"
import { TotemWatchlistCard } from "./TotemWatchlistCard"
import { TotemReactionCard } from "./TotemReactionCard"
import { TotemFeedbackButtons } from "./TotemFeedbackButtons"

// Belt-and-suspenders sanitisation of LLM output: react-markdown already
// escapes raw HTML (no rehype-raw), and on top of that we restrict rendering
// to plain text-formatting elements only. Inline links/images are stripped
// (text kept) — navigation is intentionally confirmation-gated through the
// proposeNavigation tool, never an unvetted inline <a>/<img> from the model.
const ALLOWED_MD_ELEMENTS = [
  "p", "br", "strong", "b", "em", "i", "del",
  "ul", "ol", "li", "code", "pre", "blockquote", "h3", "h4", "hr",
]

export interface TotemMessageProps {
  message: UIMessage
  onAcceptNavigation: (toolCallId: string, path: string) => void
  onDeclineNavigation: (toolCallId: string) => void
  onAcceptWatchlist: (toolCallId: string, mediaId: string) => void | Promise<void>
  onDeclineWatchlist: (toolCallId: string) => void
  onAcceptReaction: (
    toolCallId: string,
    input: { mediaId: string; familyMemberId: string; reaction: string },
  ) => void | Promise<void>
  onDeclineReaction: (toolCallId: string) => void
  onSendFeedback?: (messageId: string, rating: "UP" | "DOWN", reason?: string) => Promise<void>
  autoMode?: boolean
  isStreaming?: boolean
}

interface ToolPart {
  type: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

interface SearchMediaResult {
  results?: TotemCitedMedia[]
}

interface MediaDetailsResult {
  found?: boolean
  id?: string
  title?: string
  type?: string
  year?: number | null
  posterUrl?: string | null
  recommendedAge?: number | null
  communityAge?: number | null
  genres?: string[]
}

export function TotemMessage({
  message,
  onAcceptNavigation,
  onDeclineNavigation,
  onAcceptWatchlist,
  onDeclineWatchlist,
  onAcceptReaction,
  onDeclineReaction,
  onSendFeedback,
  autoMode = false,
  isStreaming = false,
}: TotemMessageProps) {
  const isUser = message.role === "user"
  const parts = message.parts ?? []
  const showFeedback = !isUser && !isStreaming && !!onSendFeedback && parts.some((p) => p.type === "text")

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[88%] flex-col gap-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-[var(--color-accent)] text-white shadow-sm"
            : "bg-[var(--color-card)] shadow-sm ring-1 ring-[var(--color-line)]",
        )}
        style={!isUser ? { color: "var(--color-ink)" } : undefined}
      >
        {parts.map((part, idx) => {
          if (part.type === "text") {
            return (
              <div
                key={idx}
                className={cn(
                  "prose prose-sm max-w-none",
                  isUser ? "prose-invert" : "prose-neutral",
                  "prose-p:my-1.5 prose-em:italic prose-strong:font-semibold prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5",
                )}
              >
                <ReactMarkdown allowedElements={ALLOWED_MD_ELEMENTS} unwrapDisallowed>
                  {part.text}
                </ReactMarkdown>
              </div>
            )
          }

          // Tool calls — only show output for searchMedia / getMediaDetails
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            const tp = part as ToolPart
            const toolName = tp.type.slice("tool-".length)

            if (toolName === "proposeNavigation") {
              const input = tp.input as { path?: string; label?: string; reason?: string } | undefined
              const output = tp.output as { accepted?: boolean } | undefined
              if (!input?.path || !input?.label || !input?.reason) return null
              return (
                <TotemActionCard
                  key={idx}
                  toolCallId={tp.toolCallId ?? ""}
                  path={input.path}
                  label={input.label}
                  reason={input.reason}
                  resolved={output?.accepted != null ? { accepted: !!output.accepted } : undefined}
                  autoMode={autoMode}
                  onAccept={onAcceptNavigation}
                  onDecline={onDeclineNavigation}
                />
              )
            }

            if (toolName === "proposeAddToWatchlist") {
              const input = tp.input as { mediaId?: string; mediaTitle?: string } | undefined
              const output = tp.output as
                | { accepted?: boolean; alreadyPresent?: boolean; reason?: string }
                | undefined
              if (!input?.mediaId || !input?.mediaTitle) return null
              return (
                <TotemWatchlistCard
                  key={idx}
                  toolCallId={tp.toolCallId ?? ""}
                  mediaId={input.mediaId}
                  mediaTitle={input.mediaTitle}
                  resolved={
                    output?.accepted != null
                      ? { accepted: !!output.accepted, alreadyPresent: output.alreadyPresent, reason: output.reason }
                      : undefined
                  }
                  onAccept={onAcceptWatchlist}
                  onDecline={onDeclineWatchlist}
                />
              )
            }

            if (toolName === "proposeReaction") {
              const input = tp.input as
                | {
                    mediaId?: string
                    mediaTitle?: string
                    familyMemberId?: string
                    familyMemberName?: string
                    reaction?: string
                  }
                | undefined
              const output = tp.output as { accepted?: boolean; reason?: string } | undefined
              if (
                !input?.mediaId ||
                !input?.mediaTitle ||
                !input?.familyMemberId ||
                !input?.familyMemberName ||
                !input?.reaction
              ) return null
              return (
                <TotemReactionCard
                  key={idx}
                  toolCallId={tp.toolCallId ?? ""}
                  mediaId={input.mediaId}
                  mediaTitle={input.mediaTitle}
                  familyMemberId={input.familyMemberId}
                  familyMemberName={input.familyMemberName}
                  reaction={input.reaction}
                  resolved={
                    output?.accepted != null
                      ? { accepted: !!output.accepted, reason: output.reason }
                      : undefined
                  }
                  onAccept={onAcceptReaction}
                  onDecline={onDeclineReaction}
                />
              )
            }

            if (toolName === "searchMedia" && tp.state === "output-available") {
              const out = tp.output as SearchMediaResult | undefined
              const results = out?.results ?? []
              if (results.length === 0) return null
              return (
                <div key={idx} className="flex flex-wrap gap-2 pt-1">
                  {results.slice(0, 4).map((r) => (
                    <TotemMediaCard key={r.id} media={r} enableSeenAction />
                  ))}
                </div>
              )
            }

            if (toolName === "getDiscoveryRail" && tp.state === "output-available") {
              const out = tp.output as
                | { status?: string; results?: TotemCitedMedia[]; seeAllLabel?: string }
                | undefined
              const results = out?.results ?? []
              if (out?.status !== "ok" || results.length === 0) return null
              return (
                <div key={idx} className="space-y-1.5 pt-1">
                  {out.seeAllLabel && (
                    <div className="text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--color-ink2)" }}>
                      {out.seeAllLabel}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {results.slice(0, 6).map((r) => (
                      <TotemMediaCard key={r.id} media={r} enableSeenAction />
                    ))}
                  </div>
                </div>
              )
            }

            if (toolName === "getMediaDetails" && tp.state === "output-available") {
              const out = tp.output as MediaDetailsResult | undefined
              if (!out?.found || !out.id || !out.title) return null
              return (
                <div key={idx} className="pt-1">
                  <TotemMediaCard
                    enableSeenAction
                    media={{
                      id: out.id,
                      title: out.title,
                      type: out.type ?? "MOVIE",
                      year: out.year ?? null,
                      posterUrl: out.posterUrl ?? null,
                      recommendedAge: out.recommendedAge ?? null,
                      communityAge: out.communityAge ?? null,
                      genres: out.genres ?? [],
                      shortPitch: null,
                    }}
                  />
                </div>
              )
            }

            // Other tool calls: show a discreet "consulting" hint while in flight
            if (tp.state === "input-streaming" || tp.state === "input-available") {
              return (
                <div key={idx} className="text-xs italic" style={{ color: "var(--color-ink2)" }}>
                  Totem consulte les fiches…
                </div>
              )
            }
            return null
          }

          return null
        })}
        {showFeedback && (
          <TotemFeedbackButtons
            onSubmit={async (rating, reason) => {
              await onSendFeedback!(message.id, rating, reason)
            }}
          />
        )}
      </div>
    </div>
  )
}
