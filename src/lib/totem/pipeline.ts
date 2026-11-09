import {
  stepCountIs,
  streamText,
  type ModelMessage,
  type StepResult,
  type StreamTextOnErrorCallback,
  type StreamTextOnFinishCallback,
  type StreamTextOnStepFinishCallback,
} from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { parseMediaRouteId } from "@/lib/media-route"
import {
  buildSystemPrompt,
  type FamilyMemberSnapshot,
  type PageContextSnapshot,
} from "@/lib/totem/system-prompt"
import { buildTotemTools, type TotemToolContext } from "@/lib/totem/tools"
import { pickModel, type ModelRouterDecision } from "@/lib/totem/model-router"
import { buildCareBlock, detectCrisis, type CrisisSignal } from "@/lib/totem/crisis"
import { buildHintsNote, inferTurnHints, type TurnHints } from "@/lib/totem/turn-hints"
import { TOTEM_MAX_OUTPUT_TOKENS } from "@/lib/totem/cost"

/**
 * The Totem turn pipeline, shared by the live chat (/api/totem/chat, streamed
 * to the browser) and the evaluation bench (/api/cron/totem-eval). Everything
 * that decides what the MODEL sees and how it is called lives here — page
 * context, family block, system prompt, tools, model routing and the
 * streamText settings — so the bench measures the exact code families get.
 *
 * What stays with the callers: HTTP parsing, auth, rate limits and caps,
 * conversation persistence (the route writes totem_messages; the bench never
 * does), and how the stream is consumed.
 */

/** Tool-loop bound: worst case per user turn is this many model calls. */
export const TOTEM_MAX_STEPS = 6
/** One retry instead of the SDK default of two (cost bound). */
export const TOTEM_MAX_RETRIES = 1
/** Hard stream timeout, under the chat function's 60 s maxDuration. */
export const TOTEM_STREAM_TIMEOUT_MS = 55_000

export type TotemTools = ReturnType<typeof buildTotemTools>

/** streamText's onAbort callback (the SDK does not export its type). */
export type TotemOnAbortCallback = (event: {
  readonly steps: StepResult<TotemTools>[]
}) => PromiseLike<void> | void

// ---------------------------------------------------------------------------
// Page context
// ---------------------------------------------------------------------------

/**
 * When the user is on a media fiche or a news article, resolve its title so
 * Totem understands « ce film » / « cet article » without asking. Cheap: one
 * Prisma call, only when the path matches. Enrichment only — never throws.
 */
export async function resolvePageContext(
  sourcePage: string | null | undefined,
): Promise<PageContextSnapshot | null> {
  let pageContext: PageContextSnapshot | null = null

  // News article page: /apercudecouverte/[slug]. The index/list views
  // (/apercudecouverte and /apercudecouverte/actualites) have no single story.
  if (
    typeof sourcePage === "string" &&
    sourcePage.startsWith("/apercudecouverte/") &&
    !sourcePage.startsWith("/apercudecouverte/actualites")
  ) {
    const rawSlug = sourcePage.replace(/^\/apercudecouverte\//, "").split(/[?#]/)[0]
    if (rawSlug.length > 0 && rawSlug.length < 200) {
      try {
        const n = await prisma.newsStory.findUnique({
          where: { slug: rawSlug },
          select: {
            slug: true,
            title: true,
            category: true,
            summary: true,
            publishedAt: true,
            status: true,
          },
        })
        if (n && n.status === "PUBLISHED") {
          pageContext = {
            type: "news",
            slug: n.slug,
            title: n.title,
            category: n.category,
            summary: n.summary,
            publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
          }
        }
      } catch {
        /* ignore — page context is enrichment, not required */
      }
    }
  }

  if (pageContext == null && typeof sourcePage === "string" && sourcePage.startsWith("/media/")) {
    const rawSegment = sourcePage.replace(/^\/media\//, "").split(/[?#]/)[0]
    if (rawSegment.length > 0 && rawSegment.length < 200) {
      // Route format is `<type>:<id>` (e.g. movie:abc-123). Fall back to the
      // raw segment if the colon is missing.
      const { id: parsedId } = parseMediaRouteId(rawSegment)
      const candidates = [parsedId, rawSegment].filter(
        (s, i, arr) => s && s.length > 0 && arr.indexOf(s) === i,
      )
      try {
        for (const candidate of candidates) {
          const m = await prisma.mediaItem.findUnique({
            where: { id: candidate },
            select: {
              id: true,
              title: true,
              type: true,
              expertAgeRec: true,
              releaseDate: true,
            },
          })
          if (m) {
            pageContext = {
              type: "media",
              id: m.id,
              title: m.title,
              mediaType: m.type,
              expertAgeRec: m.expertAgeRec,
              year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
            }
            break
          }
        }
      } catch {
        /* ignore — page context is enrichment, not required */
      }
    }
  }

  return pageContext
}

// ---------------------------------------------------------------------------
// Family context
// ---------------------------------------------------------------------------

/** The FamilyMember columns the prompt's family block is built from. */
export interface FamilyMemberRow {
  name: string
  birthYear: number | null
  birthMonth?: number | null
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  favoriteGenres: string[]
  avoidTopics: string[]
}

/** FamilyMember rows → the snapshot the system prompt renders. */
export function toFamilySnapshot(members: FamilyMemberRow[]): FamilyMemberSnapshot[] {
  return members.map((m) => ({
    name: m.name,
    age: getMemberAge(m.birthYear, m.birthMonth),
    sensitivities: {
      violence: m.sensitivityViolence,
      scary: m.sensitivityScary,
      sexual: m.sensitivitySexual,
      language: m.sensitivityLanguage,
      substances: m.sensitivitySubstances,
    },
    favoriteGenres: m.favoriteGenres,
    avoidTopics: m.avoidTopics,
  }))
}

/** The signed-in user's household, as the prompt sees it. */
export async function loadFamilyContext(userId: string): Promise<FamilyMemberSnapshot[]> {
  const members = await prisma.familyMember.findMany({
    where: { userId },
    take: 10,
  })
  return toFamilySnapshot(members)
}

// ---------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------

export interface TotemTurnInput {
  /** History + the new user message, as model messages (already bounded). */
  messages: ModelMessage[]
  /** The new user message's text (drives the router's keyword check). */
  userText: string
  /** null = anonymous: the prompt says so and auth-only tools refuse. */
  userId: string | null
  familyContext?: FamilyMemberSnapshot[]
  sourcePage: string | null
  pageContext: PageContextSnapshot | null
  /** User turns already persisted in this conversation, before this one. */
  turnsSoFar: number
  personalizationNudgeAllowed: boolean
  /** Tool calls made in the previous assistant turn (router input). */
  lastTurnToolCount: number
  toolContext: TotemToolContext
  /**
   * Evaluation bench only: run every turn on this model instead of the live
   * router. Never set by the chat route.
   */
  modelOverride?: string
  now?: Date
  abortSignal?: AbortSignal
  onFinish?: StreamTextOnFinishCallback<TotemTools>
  onStepFinish?: StreamTextOnStepFinishCallback<TotemTools>
  onAbort?: TotemOnAbortCallback
  onError?: StreamTextOnErrorCallback
}

/** Text of every user message before the last one (the current turn). */
function priorUserTexts(messages: ModelMessage[]): string[] {
  const texts = messages
    .filter((m) => m.role === "user")
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("\n"),
    )
  return texts.slice(0, -1)
}

export interface TotemTurn {
  result: ReturnType<typeof streamText<TotemTools>>
  model: string
  routing: ModelRouterDecision["reason"] | "override"
  tools: TotemTools
  /** Set when the crisis protocol ran this turn (crisis.ts). */
  crisis: CrisisSignal | null
  /** Audience and requested type the tools enforced this turn (turn-hints.ts). */
  hints: TurnHints
}

/**
 * Assemble the prompt, the tools and the model choice for one user turn, and
 * start the model call. Returns immediately with the streaming result.
 */
export function startTotemTurn(input: TotemTurnInput): TotemTurn {
  const now = input.now ?? new Date()

  // Who the request is for and what type is asked for, from the parent's own
  // messages — enforced by the recommendation tools (turn-hints.ts).
  const hints = inferTurnHints({
    userText: input.userText,
    priorUserTexts: priorUserTexts(input.messages),
    family: input.familyContext,
  })

  // A person in distress: care block, stronger model, no tools (crisis.ts).
  const crisis = detectCrisis(input.userText)
  const turnNotes: string[] = []
  const hintsNote = crisis ? null : buildHintsNote(hints)
  if (hintsNote) turnNotes.push(hintsNote)
  if (crisis) turnNotes.push(buildCareBlock(crisis))

  // System prompt (static head, cached + dynamic tail, sent fresh each turn).
  const { staticHead, dynamicTail } = buildSystemPrompt({
    userIsAnonymous: !input.userId,
    familyContext: input.familyContext,
    currentDate: now.toISOString().slice(0, 10),
    sourcePage: input.sourcePage,
    pageContext: input.pageContext,
    conversationTurnCount: input.turnsSoFar + 1,
    personalizationNudgeAllowed: input.personalizationNudgeAllowed,
    turnNotes,
  })

  // Tools — server tools have execute(); propose* are client-resolved.
  const tools = buildTotemTools({ ...input.toolContext, hints })

  // Escalate to the higher-capability model in a crisis, on long threads,
  // after a multi-tool turn, or on a grave keyword.
  const decision = pickModel({
    turnCount: input.turnsSoFar + 1,
    lastTurnToolCount: input.lastTurnToolCount,
    userText: input.userText,
  })
  const model = input.modelOverride ?? decision.model
  const routing = input.modelOverride ? "override" : decision.reason

  const result = streamText({
    model: anthropic(model),
    // Cache the static head; the dynamic tail is sent fresh each turn.
    system: [
      {
        role: "system" as const,
        content: staticHead,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      { role: "system" as const, content: dynamicTail },
    ],
    messages: input.messages,
    tools,
    // A crisis turn runs with NO active tool: no catalogue search, no card,
    // no link can be produced, whatever the model attempts (a call to an
    // inactive tool is refused by the SDK, never executed). Costs one cache
    // miss on a rare turn.
    ...(crisis ? { activeTools: [] as Array<keyof TotemTools> } : {}),
    stopWhen: stepCountIs(TOTEM_MAX_STEPS),
    // Cost bounds: per-step output cap (worst case = steps × cap), a single
    // retry, and a hard stream timeout under the function's maxDuration.
    maxOutputTokens: TOTEM_MAX_OUTPUT_TOKENS,
    maxRetries: TOTEM_MAX_RETRIES,
    abortSignal: input.abortSignal ?? AbortSignal.timeout(TOTEM_STREAM_TIMEOUT_MS),
    onFinish: input.onFinish,
    onStepFinish: input.onStepFinish,
    onAbort: input.onAbort,
    ...(input.onError ? { onError: input.onError } : {}),
  })

  return { result, model, routing, tools, crisis, hints }
}
