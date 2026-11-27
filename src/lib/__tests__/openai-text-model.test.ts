// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import {
  DEFAULT_OPENAI_TEXT_MODEL,
  DEFAULT_OPENAI_TEXT_REASONING_EFFORT,
  buildTextCompletionParams,
  createTextCompletion,
  isReasoningEffortRejection,
  modelFailureStatus,
  openaiTextModel,
  openaiTextReasoningEffort,
  resetReasoningEffortMemory,
  type TextCompletionParams,
} from "../openai-text-model"

/** The 400 the live API returns for reasoning_effort: "minimal" (27 Nov 2026). */
function liveEffortRejection() {
  return Object.assign(new Error("400 Supported values are: 'none', 'low', 'medium', 'high', and 'xhigh'."), {
    status: 400,
    param: "reasoning_effort",
    code: "unsupported_value",
    type: "invalid_request_error",
  })
}

const completion = { id: "c", choices: [{ message: { content: "{}" } }] }

function fakeClient(create: (p: TextCompletionParams, o?: unknown) => Promise<unknown>) {
  const fn = vi.fn(create)
  return { client: { chat: { completions: { create: fn } } } as never, create: fn }
}

const messages = [{ role: "user" as const, content: "x" }]

beforeEach(() => resetReasoningEffortMemory())
afterEach(() => vi.restoreAllMocks())

describe("model id and reasoning effort", () => {
  it("defaults to gpt-6.1-terra with effort none (the closest to the old « minimal »)", () => {
    expect(DEFAULT_OPENAI_TEXT_MODEL).toBe("gpt-6.1-terra")
    expect(DEFAULT_OPENAI_TEXT_REASONING_EFFORT).toBe("none")
    expect(openaiTextModel({})).toBe("gpt-6.1-terra")
    expect(openaiTextReasoningEffort({})).toBe("none")
  })

  it("honours OPENAI_TEXT_MODEL and OPENAI_TEXT_REASONING_EFFORT", () => {
    expect(openaiTextModel({ OPENAI_TEXT_MODEL: " other-model " })).toBe("other-model")
    expect(openaiTextModel({ OPENAI_TEXT_MODEL: "  " })).toBe("gpt-6.1-terra")
    expect(openaiTextReasoningEffort({ OPENAI_TEXT_REASONING_EFFORT: "LOW" })).toBe("low")
    expect(openaiTextReasoningEffort({ OPENAI_TEXT_REASONING_EFFORT: "omit" })).toBeNull()
  })

  it("builds the shared params, effort left out when omitted", () => {
    expect(buildTextCompletionParams({ messages, maxCompletionTokens: 4000 }, {})).toEqual({
      model: "gpt-6.1-terra",
      messages,
      max_completion_tokens: 4000,
      reasoning_effort: "none",
    })
    const omitted = buildTextCompletionParams({ messages, maxCompletionTokens: 10 }, { OPENAI_TEXT_REASONING_EFFORT: "omit" })
    expect("reasoning_effort" in omitted).toBe(false)
    const explicit = buildTextCompletionParams({ messages, maxCompletionTokens: 10, model: "m", reasoningEffort: "low" }, {})
    expect(explicit).toMatchObject({ model: "m", reasoning_effort: "low" })
  })
})

describe("isReasoningEffortRejection", () => {
  it("matches the live 400 (param reasoning_effort, message without the field name)", () => {
    expect(isReasoningEffortRejection(liveEffortRejection())).toBe(true)
    expect(isReasoningEffortRejection({ status: 400, error: { param: "reasoning_effort" } })).toBe(true)
    expect(isReasoningEffortRejection({ status: 400, message: "Unsupported parameter: 'reasoning_effort'" })).toBe(true)
  })

  it("ignores any other error", () => {
    expect(isReasoningEffortRejection({ status: 400, param: "max_completion_tokens", message: "too large" })).toBe(false)
    expect(isReasoningEffortRejection({ status: 500, param: "reasoning_effort" })).toBe(false)
    expect(isReasoningEffortRejection({ status: 429, message: "rate limit" })).toBe(false)
    expect(isReasoningEffortRejection(new Error("reasoning"))).toBe(false)
    expect(isReasoningEffortRejection(null)).toBe(false)
  })
})

describe("createTextCompletion", () => {
  const params = () => buildTextCompletionParams({ messages, maxCompletionTokens: 100, reasoningEffort: "minimal" }, {})

  it("retries ONCE without reasoning_effort on that 400, warns, and keeps the request options", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { client, create } = fakeClient(async (p) => {
      if (p.reasoning_effort !== undefined) throw liveEffortRejection()
      return completion
    })
    const signal = new AbortController().signal
    await expect(createTextCompletion(client, params(), { signal })).resolves.toBe(completion)
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].reasoning_effort).toBe("minimal")
    expect("reasoning_effort" in create.mock.calls[1][0]).toBe(false)
    expect(create.mock.calls[1][1]).toEqual({ signal })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain("reasoning_effort")
  })

  it("remembers the rejection: the next call for that model skips the field directly", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { client, create } = fakeClient(async (p) => {
      if (p.reasoning_effort !== undefined) throw liveEffortRejection()
      return completion
    })
    await createTextCompletion(client, params())
    await createTextCompletion(client, params())
    expect(create).toHaveBeenCalledTimes(3)
  })

  it("does not loop: a second rejection without the field is rethrown", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { client, create } = fakeClient(async () => {
      throw liveEffortRejection()
    })
    await expect(createTextCompletion(client, params())).rejects.toMatchObject({ status: 400 })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("never retries on other errors", async () => {
    for (const err of [
      Object.assign(new Error("429 Rate limit"), { status: 429 }),
      Object.assign(new Error("400 bad messages"), { status: 400, param: "messages" }),
      Object.assign(new Error("404 model not found"), { status: 404, param: "model" }),
      new Error("Request was aborted."),
    ]) {
      const { client, create } = fakeClient(async () => {
        throw err
      })
      await expect(createTextCompletion(client, params())).rejects.toBe(err)
      expect(create).toHaveBeenCalledOnce()
    }
  })

  it("does not retry when no effort was sent", async () => {
    const { client, create } = fakeClient(async () => {
      throw liveEffortRejection()
    })
    const p = buildTextCompletionParams({ messages, maxCompletionTokens: 1, reasoningEffort: null }, {})
    await expect(createTextCompletion(client, p)).rejects.toMatchObject({ status: 400 })
    expect(create).toHaveBeenCalledOnce()
  })
})

describe("modelFailureStatus", () => {
  it("every attempt failed → error; ≥ 50 % → partial; else the job's own rule", () => {
    expect(modelFailureStatus({ attempted: 5, modelFailures: 5, fallback: "partial" })).toBe("error")
    expect(modelFailureStatus({ attempted: 1, modelFailures: 1, fallback: "partial" })).toBe("error")
    expect(modelFailureStatus({ attempted: 4, modelFailures: 2, fallback: "success" })).toBe("partial")
    expect(modelFailureStatus({ attempted: 5, modelFailures: 2, fallback: "success" })).toBe("success")
    expect(modelFailureStatus({ attempted: 5, modelFailures: 2, fallback: "partial" })).toBe("partial")
    expect(modelFailureStatus({ attempted: 0, modelFailures: 0, fallback: "success" })).toBe("success")
  })
})

// The GPT-5 family is shut down on 11 Dec 2026: no source may still name it.
// Only the comparison script names the old model, on purpose.
describe("no retired model id left in src/ or scripts/", () => {
  const root = path.resolve(__dirname, "../../..")
  const banned = ["gpt-5" + "-mini", '"gpt-5' + '"', "'gpt-5" + "'"]
  const exempt = new Set([
    path.join(root, "scripts", "compare-text-models.ts"),
    __filename,
  ])

  function walk(dir: string, out: string[]) {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.(ts|tsx|js|mjs|cjs|jsx)$/.test(name)) out.push(full)
    }
  }

  it("finds none", () => {
    const files: string[] = []
    walk(path.join(root, "src"), files)
    walk(path.join(root, "scripts"), files)
    expect(files.length).toBeGreaterThan(50)
    const offenders = files
      .filter((f) => !exempt.has(f))
      .filter((f) => {
        const text = readFileSync(f, "utf8")
        return banned.some((b) => text.includes(b))
      })
      .map((f) => path.relative(root, f))
    expect(offenders).toEqual([])
  })
})
