import type { LanguageModelUsage, ModelMessage, StepResult, ToolSet } from "ai"
import { addUsage, EMPTY_USAGE, extractUsage, type TotemUsageRecord } from "./usage"

/**
 * What one assistant turn leaves behind, built from EVERY step of the tool
 * loop. Shared by the chat route (written to totem_messages) and the
 * evaluation bench (kept in memory), so both see the same record.
 *
 * Before 2026-11 only the final step was persisted (`onFinish` exposes the
 * final step's text, toolCalls and toolResults): a searchMedia call in step 1
 * followed by the answer in step 2 left no trace of the search, citedMediaIds
 * stayed empty, and a turn whose last step was a bare action card was logged
 * as a blank reply even though the parent saw text.
 */

export type TurnOutcomeKind = "finished" | "aborted" | "client_disconnected" | "error" | "incomplete"

export interface SerializedToolCall {
  type: "tool-call"
  step: number
  toolCallId: string
  toolName: string
  input: unknown
}

export interface SerializedToolResult {
  type: "tool-result" | "tool-error"
  step: number
  toolCallId: string
  toolName: string
  output?: unknown
  error?: string
}

export interface AssistantTurnRecord {
  /** Every step's text, in order — what the parent saw. */
  content: string
  toolCalls: SerializedToolCall[]
  toolResults: SerializedToolResult[]
  /** Response messages of all completed steps (trusted history replay). */
  modelMessages: ModelMessage[]
  citedMediaIds: string[]
  usage: TotemUsageRecord
  /** The SDK finish reason for a finished turn, else the outcome kind. */
  finishReason: string
}

const MAX_ERROR_CHARS = 300

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "erreur"
  return raw.length > MAX_ERROR_CHARS ? `${raw.slice(0, MAX_ERROR_CHARS - 1)}…` : raw
}

/**
 * Catalogue ids found in tool outputs: `results[].id` (searchMedia,
 * getDiscoveryRail) and a top-level `id` (getMediaDetails). Off-catalogue
 * cinema cards (`tmdb-…`) are not catalogue ids and are left out.
 */
export function extractCitedMediaIds(results: ReadonlyArray<{ output?: unknown }>): string[] {
  const ids = new Set<string>()
  const add = (id: unknown) => {
    if (typeof id === "string" && id.length > 0 && !id.startsWith("tmdb-")) ids.add(id)
  }
  for (const r of results) {
    const out = r.output
    if (!out || typeof out !== "object") continue
    const list = (out as { results?: unknown }).results
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === "object") add((item as { id?: unknown }).id)
      }
    }
    add((out as { id?: unknown }).id)
  }
  return Array.from(ids)
}

export function buildAssistantTurnRecord<TOOLS extends ToolSet = ToolSet>(args: {
  steps: ReadonlyArray<StepResult<TOOLS>>
  kind: TurnOutcomeKind
  /** onFinish's summed usage; aborted turns sum their completed steps. */
  totalUsage?: LanguageModelUsage
  /** onFinish's finish reason (finished turns only). */
  finishReason?: string
}): AssistantTurnRecord {
  const { steps, kind } = args
  const toolCalls: SerializedToolCall[] = []
  const toolResults: SerializedToolResult[] = []
  const texts: string[] = []

  steps.forEach((step, index) => {
    if (step.text.trim().length > 0) texts.push(step.text)
    for (const part of step.content) {
      if (part.type === "tool-call") {
        toolCalls.push({
          type: "tool-call",
          step: index,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        })
      } else if (part.type === "tool-result") {
        toolResults.push({
          type: "tool-result",
          step: index,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.output,
        })
      } else if (part.type === "tool-error") {
        toolResults.push({
          type: "tool-error",
          step: index,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          error: errorMessage(part.error),
        })
      }
    }
  })

  const usage = args.totalUsage
    ? extractUsage(args.totalUsage)
    : steps.reduce((acc, step) => addUsage(acc, extractUsage(step.usage)), EMPTY_USAGE)

  const lastStep = steps.at(-1)

  return {
    content: texts.join("\n\n"),
    toolCalls,
    toolResults,
    modelMessages: lastStep ? [...lastStep.response.messages] : [],
    citedMediaIds: extractCitedMediaIds(toolResults),
    usage,
    finishReason: kind === "finished" ? (args.finishReason ?? "stop") : kind,
  }
}

/**
 * Collects the steps of one turn and settles it exactly once, whichever of
 * finish / abort / client disconnect / stream end comes first. streamText's
 * onAbort is not awaited by the SDK and a disconnected client never triggers
 * onFinish, so without a single settle point an interrupted turn either
 * vanished from the logs or could be written twice.
 */
export function createTurnRecorder<TOOLS extends ToolSet = ToolSet>(
  settle: (record: AssistantTurnRecord, kind: TurnOutcomeKind) => Promise<void> | void,
) {
  const steps: StepResult<TOOLS>[] = []
  let settled = false
  let error: unknown = null

  const complete = async (
    kind: TurnOutcomeKind,
    extra: { steps?: ReadonlyArray<StepResult<TOOLS>>; totalUsage?: LanguageModelUsage; finishReason?: string } = {},
  ) => {
    // Flip synchronously: callbacks can race (onAbort is fire-and-forget).
    if (settled) return
    settled = true
    const record = buildAssistantTurnRecord({
      steps: extra.steps ?? steps,
      kind,
      totalUsage: extra.totalUsage,
      finishReason: extra.finishReason,
    })
    await settle(record, kind)
  }

  return {
    get settled() {
      return settled
    },
    get error() {
      return error
    },
    onStepFinish(step: StepResult<TOOLS>) {
      steps.push(step)
    },
    onError(e: unknown) {
      error ??= e
    },
    finish(event: { steps: ReadonlyArray<StepResult<TOOLS>>; totalUsage: LanguageModelUsage; finishReason: string }) {
      return complete("finished", event)
    },
    abort(event: { steps: ReadonlyArray<StepResult<TOOLS>> }) {
      return complete("aborted", { steps: event.steps })
    },
    disconnect() {
      return complete("client_disconnected")
    },
    /** Stream ended: settles a turn that never reached onFinish (fatal error). */
    end() {
      return complete(error ? "error" : "incomplete")
    },
  }
}
