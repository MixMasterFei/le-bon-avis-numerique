import type { StepResult } from "ai"
import { prisma } from "@/lib/prisma"
import { matchMediaIdsByTitle } from "@/lib/search-normalize"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { estimateCostUsd } from "@/lib/totem/cost"
import { buildTrustedHistory, isClientToolName, type ClientToolOutcome, type StoredTurnRow } from "@/lib/totem/history"
import { mentionsPersonalizationNudge } from "@/lib/totem/persistence"
import {
  resolvePageContext,
  startTotemTurn,
  TOTEM_STREAM_TIMEOUT_MS,
  type TotemTools,
} from "@/lib/totem/pipeline"
import { createTurnRecorder, type AssistantTurnRecord } from "@/lib/totem/turn-record"
import { checkTurn } from "./checks"
import {
  createEvalFamilyData,
  EVAL_FAMILY,
  EVAL_USER_ID,
  evalFamilySnapshot,
  findEvalMember,
  type EvalHousehold,
} from "./family"
import { judgeTurn } from "./judge"
import type {
  EvalScenario,
  MediaFact,
  ScenarioResult,
  StepTrace,
  SubjectQuery,
  TurnResult,
  TurnTrace,
} from "./types"

/**
 * Runs scenarios through the SAME pipeline as the live chat — prompt, tools,
 * model call (startTotemTurn) and history reconstruction (buildTrustedHistory)
 * — with the fictional household in place of a signed-in family. It only
 * READS the catalogue: nothing is written to totem_messages or anywhere else.
 */

export interface EvalRunOptions {
  scenarios: EvalScenario[]
  /** Forced model for every turn; undefined = the live router (production behaviour). */
  model?: string
  /** Deployment origin, for the tools that call the site's own API (cinema rail). */
  origin: string
  concurrency?: number
  /** No new scenario starts after this many ms. */
  launchBudgetMs?: number
  /** In-flight turns are aborted after this many ms. */
  hardBudgetMs?: number
  judge?: boolean
}

export interface EvalRunResult {
  model: string
  startedAt: string
  durationMs: number
  scenarios: ScenarioResult[]
}

export const EVAL_DEFAULT_CONCURRENCY = 5
export const EVAL_LAUNCH_BUDGET_MS = 200_000
export const EVAL_HARD_BUDGET_MS = 265_000

const FACT_SELECT = {
  id: true,
  title: true,
  originalTitle: true,
  type: true,
  expertAgeRec: true,
  communityAgeRec: true,
  isEnriched: true,
  officialRating: true,
} as const

type FactRow = {
  id: string
  title: string
  originalTitle: string | null
  type: string
  expertAgeRec: number | null
  communityAgeRec: number | null
  isEnriched: boolean
  officialRating: string | null
}

const toFact = (r: FactRow): MediaFact => ({ ...r })

/** A scenario subject, as the catalogue holds it today. */
export async function resolveSubject(q: SubjectQuery): Promise<MediaFact | null> {
  const ids = await matchMediaIdsByTitle(q.q, { limit: 25 })
  if (ids.length === 0) return null
  const rows = (await prisma.mediaItem.findMany({
    where: { id: { in: ids }, ...(q.type ? { type: q.type } : { type: { not: "MANGA" } }) },
    select: FACT_SELECT,
  })) as FactRow[]
  const pos = new Map(ids.map((id, i) => [id, i]))
  const ordered = [...rows].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
  const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const wanted = key(q.exact ?? q.q)
  const exact = ordered.filter((r) => key(r.title) === wanted || (r.originalTitle && key(r.originalTitle) === wanted))
  const pick =
    exact.find((r) => r.isEnriched) ?? exact[0] ?? ordered.find((r) => r.isEnriched) ?? ordered[0] ?? null
  return pick ? toFact(pick) : null
}

async function fetchFacts(ids: string[]): Promise<Map<string, MediaFact>> {
  const unique = [...new Set(ids.filter((id) => id && !id.startsWith("tmdb-")))]
  if (unique.length === 0) return new Map()
  const rows = (await prisma.mediaItem.findMany({ where: { id: { in: unique } }, select: FACT_SELECT })) as FactRow[]
  return new Map(rows.map((r) => [r.id, toFact(r)]))
}

function idsInResults(steps: StepTrace[]): string[] {
  const ids: string[] = []
  for (const s of steps)
    for (const r of s.toolResults) {
      const o = r.output as Record<string, unknown> | null
      if (!o || typeof o !== "object") continue
      if (Array.isArray(o.results)) for (const it of o.results) {
        const id = (it as { id?: unknown })?.id
        if (typeof id === "string") ids.push(id)
      }
      if (typeof o.id === "string") ids.push(o.id)
    }
  return ids
}

function toStepTrace(step: StepResult<TotemTools>): StepTrace {
  return {
    text: step.text,
    toolCalls: step.toolCalls.map((c) => ({ toolCallId: c.toolCallId, toolName: c.toolName, input: c.input })),
    toolResults: step.toolResults.map((r) => ({ toolCallId: r.toolCallId, toolName: r.toolName, output: r.output })),
  }
}

function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.length > 200 ? `${m.slice(0, 199)}…` : m
}

/** How the simulated parent answers this turn's action cards. */
function resolveCards(
  steps: StepTrace[],
  mode: "ignore" | "accept" | "decline" | undefined,
  outcomes: Map<string, ClientToolOutcome>,
  household: EvalHousehold | null,
) {
  if (!mode || mode === "ignore") return
  for (const s of steps)
    for (const c of s.toolCalls) {
      if (!isClientToolName(c.toolName)) continue
      const accepted = mode === "accept"
      const output: Record<string, unknown> =
        c.toolName === "proposeNavigation"
          ? { accepted, reason: accepted ? "user_confirmed" : "user_declined" }
          : c.toolName === "proposeAddToWatchlist"
            ? accepted
              ? { accepted: true, alreadyPresent: false }
              : { accepted: false, reason: "user_declined" }
            : accepted
              ? { accepted: true }
              : { accepted: false, reason: "user_declined" }
      outcomes.set(c.toolCallId, { toolCallId: c.toolCallId, toolName: c.toolName, output })
      // An accepted reaction is written for real in production (POST
      // /api/user/reaction), which is what hides a seen title afterwards.
      if (accepted && c.toolName === "proposeReaction" && household) {
        const input = (c.input ?? {}) as Record<string, unknown>
        if (typeof input.mediaId === "string" && typeof input.familyMemberId === "string") {
          household.reactions.push({
            memberId: input.familyMemberId,
            mediaId: input.mediaId,
            mediaTitle: typeof input.mediaTitle === "string" ? input.mediaTitle : "",
            mediaType: "MOVIE",
            reaction: typeof input.reaction === "string" ? input.reaction : "WATCHED",
          })
        }
      }
    }
}

async function runScenario(
  scenario: EvalScenario,
  opts: EvalRunOptions,
  deadlines: { hard: number; abort: AbortSignal },
): Promise<ScenarioResult> {
  const base = { id: scenario.id, category: scenario.category, title: scenario.title, costUsd: 0, latencyMs: 0 }
  const skip = (reason: string): ScenarioResult => ({ ...base, status: "skipped", skipReason: reason, turns: [] })

  // Subjects and page come from today's catalogue — never hard-coded.
  const subjects = new Map<string, MediaFact>()
  for (const [key, q] of Object.entries(scenario.subjects ?? {})) {
    const fact = await resolveSubject(q)
    if (!fact) return skip(`titre absent du catalogue : ${q.q}`)
    subjects.set(key, fact)
  }

  let sourcePage: string | null = null
  let page: { media: MediaFact | null; newsTitle: string | null; newsSlug: string | null } = {
    media: null,
    newsTitle: null,
    newsSlug: null,
  }
  const spec = scenario.sourcePage
  if (spec && "path" in spec) sourcePage = spec.path
  if (spec && "subject" in spec) {
    const media = subjects.get(spec.subject)
    if (!media) return skip(`page introuvable : ${spec.subject}`)
    sourcePage = `/media/${toMediaRouteId(media.type as MediaType, media.id)}`
    page = { ...page, media }
  }
  if (spec && "latestNews" in spec) {
    const story = await prisma.newsStory.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true },
    })
    if (!story) return skip("aucune actualité publiée")
    sourcePage = `/apercudecouverte/${story.slug}`
    page = { ...page, newsTitle: story.title, newsSlug: story.slug }
  }
  const pageContext = await resolvePageContext(sourcePage)

  const signedIn = scenario.family === "eval"
  const household: EvalHousehold | null = signedIn
    ? {
        members: EVAL_FAMILY,
        reactions: (scenario.seen ?? []).flatMap((s) => {
          const member = findEvalMember(s.member)
          const media = subjects.get(s.subject)
          return member && media
            ? [{ memberId: member.id, mediaId: media.id, mediaTitle: media.title, mediaType: media.type, reaction: s.reaction }]
            : []
        }),
      }
    : null
  const userId = signedIn ? EVAL_USER_ID : null

  const rows: StoredTurnRow[] = []
  const outcomes = new Map<string, ClientToolOutcome>()
  const traces: TurnTrace[] = []

  for (let i = 0; i < scenario.turns.length; i++) {
    if (Date.now() > deadlines.hard) {
      return { ...skip("budget de temps épuisé en cours de scénario"), costUsd: traces.reduce((s, t) => s + (t.costUsd ?? 0), 0) }
    }
    const turn = scenario.turns[i]
    const history = buildTrustedHistory({ rows, userText: turn.user, outcomes })
    const lastAssistant = [...rows].reverse().find((r) => r.role === "assistant")
    const personalizationNudgeAllowed =
      !userId && i >= 1 && !(lastAssistant && mentionsPersonalizationNudge(lastAssistant.content))

    const steps: StepResult<TotemTools>[] = []
    let record: AssistantTurnRecord | null = null
    const recorder = createTurnRecorder<TotemTools>((r) => {
      record = r
    })
    const startedAt = Date.now()
    let model = opts.model ?? ""
    let routing = "override"
    let error: string | undefined
    try {
      const started = startTotemTurn({
        messages: history.messages,
        userText: turn.user,
        userId,
        familyContext: signedIn ? evalFamilySnapshot() : undefined,
        sourcePage,
        pageContext,
        turnsSoFar: i,
        personalizationNudgeAllowed,
        lastTurnToolCount: history.lastTurnToolCount,
        shownMedia: history.shownMedia,
        toolContext: {
          origin: opts.origin,
          cookieHeader: null,
          userId,
          ...(household ? { familyData: createEvalFamilyData(household) } : {}),
        },
        modelOverride: opts.model,
        abortSignal: AbortSignal.any([AbortSignal.timeout(TOTEM_STREAM_TIMEOUT_MS), deadlines.abort]),
        onStepFinish: (step) => {
          steps.push(step)
          recorder.onStepFinish(step)
        },
        onFinish: (event) => recorder.finish(event),
        onAbort: (event) => recorder.abort(event),
        onError: ({ error: e }) => recorder.onError(e),
      })
      model = started.model
      routing = started.routing
      await started.result.consumeStream({ onError: (e) => recorder.onError(e) })
    } catch (e) {
      recorder.onError(e)
    }
    await recorder.end()
    if (recorder.error) error = errorMessage(recorder.error)

    const settled = record as AssistantTurnRecord | null
    const latencyMs = Date.now() - startedAt
    const stepTraces = steps.map(toStepTrace)
    const usage = settled?.usage ?? {
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      uncachedInputTokens: null,
      cacheWriteInputTokens: null,
    }
    traces.push({
      index: i,
      user: turn.user,
      steps: stepTraces,
      text: settled?.content ?? "",
      finishReason: settled?.finishReason ?? "error",
      model,
      routing,
      latencyMs,
      usage,
      costUsd: estimateCostUsd(model, usage),
      ...(error ? { error } : {}),
    })

    // What the route would have stored for this exchange.
    rows.push({ role: "user", content: turn.user })
    rows.push({
      role: "assistant",
      content: settled?.content ?? "",
      modelMessages: settled?.modelMessages ?? [],
      toolCalls: settled?.toolCalls ?? [],
      finishReason: settled?.finishReason ?? "error",
    })
    resolveCards(stepTraces, turn.cards, outcomes, household)
  }

  const facts = await fetchFacts([
    ...traces.flatMap((t) => idsInResults(t.steps)),
    ...[...subjects.values()].map((s) => s.id),
  ])
  for (const s of subjects.values()) if (!facts.has(s.id)) facts.set(s.id, s)

  const turns: TurnResult[] = []
  for (let i = 0; i < traces.length; i++) {
    const checks = checkTurn({ scenario, turnIndex: i, traces, facts, subjects, page, family: EVAL_FAMILY })
    const judge = opts.judge ? await judgeTurn(scenario, i, traces) : undefined
    turns.push({ trace: traces[i], checks, ...(judge ? { judge } : {}) })
  }

  return {
    ...base,
    status: turns.every((t) => t.checks.every((c) => c.pass)) ? "pass" : "fail",
    turns,
    costUsd: traces.reduce((s, t) => s + (t.costUsd ?? 0), 0),
    latencyMs: traces.reduce((s, t) => s + t.latencyMs, 0),
  }
}

/** Runs the scenarios with bounded concurrency inside the function's time budget. */
export async function runEvalSuite(opts: EvalRunOptions): Promise<EvalRunResult> {
  const start = Date.now()
  const launchBy = start + (opts.launchBudgetMs ?? EVAL_LAUNCH_BUDGET_MS)
  const hard = start + (opts.hardBudgetMs ?? EVAL_HARD_BUDGET_MS)
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(new Error("budget de temps du banc épuisé")), Math.max(0, hard - start))

  const results: ScenarioResult[] = new Array(opts.scenarios.length)
  let next = 0
  const worker = async () => {
    while (next < opts.scenarios.length) {
      const index = next++
      const scenario = opts.scenarios[index]
      if (Date.now() > launchBy) {
        results[index] = {
          id: scenario.id,
          category: scenario.category,
          title: scenario.title,
          status: "skipped",
          skipReason: "budget de temps épuisé avant le départ",
          turns: [],
          costUsd: 0,
          latencyMs: 0,
        }
        continue
      }
      try {
        results[index] = await runScenario(scenario, opts, { hard, abort: abort.signal })
      } catch (e) {
        results[index] = {
          id: scenario.id,
          category: scenario.category,
          title: scenario.title,
          status: "skipped",
          skipReason: `erreur du banc : ${errorMessage(e)}`,
          turns: [],
          costUsd: 0,
          latencyMs: 0,
        }
      }
    }
  }

  try {
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? EVAL_DEFAULT_CONCURRENCY, 8))
    await Promise.all(Array.from({ length: concurrency }, worker))
  } finally {
    clearTimeout(timer)
  }

  return {
    model: opts.model ?? "live",
    startedAt: new Date(start).toISOString(),
    durationMs: Date.now() - start,
    scenarios: results,
  }
}
