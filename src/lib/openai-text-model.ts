import type OpenAI from "openai"

/**
 * Single source of truth for the OpenAI text model behind the catalogue
 * pipelines (daily enrichment, synopsis audit, trigger-warning backfill, SEO
 * synopsis rewrites, the backfill script).
 *
 * Migrated from the GPT-5 family (shut down by OpenAI on 11 Dec 2026) to
 * gpt-6.1-terra — approved by Xavier, 27 Nov 2026. `OPENAI_TEXT_MODEL`
 * overrides the id without a deploy of new code (a Vercel env change is
 * enough), e.g. to roll back or to try a sibling model.
 *
 * Reasoning effort: the old model took "minimal". gpt-6.1-terra rejects it
 * (400 invalid_request_error, param `reasoning_effort`, code
 * `unsupported_value`: « Supported values are: 'none', 'low', 'medium',
 * 'high', and 'xhigh' » — checked against the live API, 27 Nov 2026). The
 * default is "none", the closest to "minimal": it keeps the latency and the
 * token budgets each call site was tuned for, and no reasoning tokens eat
 * `max_completion_tokens` (the empty-content failure the enrichment route
 * documents). `OPENAI_TEXT_REASONING_EFFORT` overrides it ("low", "medium"…;
 * "omit" sends no effort at all). If the API still answers 400 about the
 * field, `createTextCompletion` retries once without it and remembers the
 * rejection for the rest of the process, so later calls don't pay a wasted
 * round-trip.
 *
 * gpt-4o / gpt-4o-mini call sites (deep enrichment, imports…) are NOT routed
 * through here: they are not reasoning models and are not being retired.
 */

export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-6.1-terra"
export const DEFAULT_OPENAI_TEXT_REASONING_EFFORT = "none"
/** Env value that disables the reasoning_effort field entirely. */
export const OMIT_REASONING_EFFORT = "omit"

type Env = Record<string, string | undefined>

export function openaiTextModel(env: Env = process.env): string {
  const override = env.OPENAI_TEXT_MODEL?.trim()
  return override ? override : DEFAULT_OPENAI_TEXT_MODEL
}

/** The effort to send, or null when the field must be left out. */
export function openaiTextReasoningEffort(env: Env = process.env): string | null {
  const override = env.OPENAI_TEXT_REASONING_EFFORT?.trim().toLowerCase()
  if (!override) return DEFAULT_OPENAI_TEXT_REASONING_EFFORT
  return override === OMIT_REASONING_EFFORT ? null : override
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

/**
 * Chat-completions params for the text model. `reasoning_effort` is typed as a
 * plain string because the SDK's union does not know the new model's values.
 */
export interface TextCompletionParams {
  model: string
  messages: ChatMessage[]
  max_completion_tokens: number
  reasoning_effort?: string
  response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"]
}

export function buildTextCompletionParams(
  input: {
    messages: ChatMessage[]
    maxCompletionTokens: number
    responseFormat?: TextCompletionParams["response_format"]
    /** Explicit model id (the comparison script runs the old model on purpose). */
    model?: string
    /** Explicit effort; null leaves the field out. Defaults to the env/default. */
    reasoningEffort?: string | null
  },
  env: Env = process.env,
): TextCompletionParams {
  const effort = input.reasoningEffort === undefined ? openaiTextReasoningEffort(env) : input.reasoningEffort
  const params: TextCompletionParams = {
    model: input.model ?? openaiTextModel(env),
    messages: input.messages,
    max_completion_tokens: input.maxCompletionTokens,
  }
  if (effort) params.reasoning_effort = effort
  if (input.responseFormat) params.response_format = input.responseFormat
  return params
}

/**
 * True for the 400 the API returns when a model does not accept the
 * reasoning_effort value (or reasoning at all): param `reasoning_effort` (the
 * live answer: code `unsupported_value`, message « Supported values are: … »,
 * which does not name the field), or a message that mentions reasoning.
 * Works for the SDK's BadRequestError (top-level `param`) and for the raw
 * `error` body.
 */
export function isReasoningEffortRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const e = error as {
    status?: unknown
    message?: unknown
    param?: unknown
    error?: { message?: unknown; param?: unknown } | null
  }
  if (e.status !== 400) return false
  const param =
    typeof e.param === "string" ? e.param : typeof e.error?.param === "string" ? e.error.param : ""
  if (param.toLowerCase().startsWith("reasoning")) return true
  const message = [e.message, e.error?.message]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase()
  return message.includes("reasoning")
}

/** Models that rejected reasoning_effort in this process — skip the field next time. */
const effortRejectedModels = new Set<string>()

/** Test hook: forget remembered rejections. */
export function resetReasoningEffortMemory(): void {
  effortRejectedModels.clear()
}

type CreateOptions = Parameters<OpenAI["chat"]["completions"]["create"]>[1]
export type TextCompletion = OpenAI.Chat.Completions.ChatCompletion

/**
 * `openai.chat.completions.create` for the text model, non-streaming. On a 400
 * about reasoning_effort it retries ONCE without the field (console.warn, the
 * API key is never logged); every other error is rethrown untouched, so each
 * call site keeps its own retry / abort / fallback handling.
 */
export async function createTextCompletion(
  openai: Pick<OpenAI, "chat">,
  params: TextCompletionParams,
  options?: CreateOptions,
): Promise<TextCompletion> {
  const send = (p: TextCompletionParams) =>
    openai.chat.completions.create(
      p as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      options,
    ) as Promise<TextCompletion>

  let effective = params
  if (params.reasoning_effort !== undefined && effortRejectedModels.has(params.model)) {
    effective = withoutReasoningEffort(params)
  }

  try {
    return await send(effective)
  } catch (error) {
    if (effective.reasoning_effort === undefined || !isReasoningEffortRejection(error)) throw error
    const message = error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? "")
    console.warn(
      `[openai-text-model] ${params.model} rejected reasoning_effort="${params.reasoning_effort}" (${message.slice(0, 200)}) — retrying without it`,
    )
    effortRejectedModels.add(params.model)
    return send(withoutReasoningEffort(effective))
  }
}

function withoutReasoningEffort(params: TextCompletionParams): TextCompletionParams {
  const copy = { ...params }
  delete copy.reasoning_effort
  return copy
}

/**
 * Status rule shared by the jobs whose work is one model call per item
 * (enrichment, synopsis audit): a dead model must not look green.
 *   - every attempted item failed at the model call → "error" (failure email)
 *   - ≥ 50 % failed → "partial"
 *   - otherwise the job's own rule decides (`fallback`).
 * `attempted` counts only items where the model was actually called.
 */
export function modelFailureStatus(input: {
  attempted: number
  modelFailures: number
  fallback: "success" | "partial" | "error"
}): "success" | "partial" | "error" {
  const { attempted, modelFailures, fallback } = input
  if (attempted > 0 && modelFailures >= attempted) return "error"
  if (attempted > 0 && modelFailures * 2 >= attempted) return fallback === "error" ? "error" : "partial"
  return fallback
}
