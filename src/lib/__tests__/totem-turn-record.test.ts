// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import type { StepResult, ToolSet } from "ai"
import { buildAssistantTurnRecord, createTurnRecorder, extractCitedMediaIds } from "../totem/turn-record"

function usage(noCache: number, read: number, write: number, out: number) {
  return {
    inputTokens: noCache + read + write,
    inputTokenDetails: { noCacheTokens: noCache, cacheReadTokens: read, cacheWriteTokens: write },
    outputTokens: out,
    outputTokenDetails: { textTokens: out, reasoningTokens: undefined },
    totalTokens: noCache + read + write + out,
  }
}

/** Minimal StepResult: the fields the record reads. */
function step(text: string, content: unknown[], messages: unknown[]): StepResult<ToolSet> {
  return { text, content, usage: usage(100, 1000, 0, 20), response: { messages } } as never
}

const searchStep = step(
  "Je regarde.",
  [
    { type: "text", text: "Je regarde." },
    { type: "tool-call", toolCallId: "c1", toolName: "searchMedia", input: { q: "Interstellar" } },
    {
      type: "tool-result",
      toolCallId: "c1",
      toolName: "searchMedia",
      input: { q: "Interstellar" },
      output: { results: [{ id: "m-1", title: "Interstellar" }, { id: "tmdb-99", title: "Hors catalogue" }] },
    },
  ],
  [{ role: "assistant", content: [] }, { role: "tool", content: [] }],
)
const answerStep = step(
  "Conseillé dès 12 ans.",
  [
    { type: "text", text: "Conseillé dès 12 ans." },
    { type: "tool-call", toolCallId: "c2", toolName: "proposeNavigation", input: { path: "/media/movie:m-1" } },
    { type: "tool-error", toolCallId: "c3", toolName: "getMediaDetails", input: {}, error: new Error("db down") },
  ],
  [{ role: "assistant", content: [] }, { role: "tool", content: [] }, { role: "assistant", content: [] }],
)

describe("buildAssistantTurnRecord — every step, not just the last (review #7)", () => {
  it("keeps all steps' text, tool calls and results, and fills citedMediaIds", () => {
    const r = buildAssistantTurnRecord({
      steps: [searchStep, answerStep],
      kind: "finished",
      totalUsage: usage(200, 2000, 0, 40) as never,
      finishReason: "tool-calls",
    })
    expect(r.content).toBe("Je regarde.\n\nConseillé dès 12 ans.")
    expect(r.toolCalls.map((c) => [c.step, c.toolName])).toEqual([
      [0, "searchMedia"],
      [1, "proposeNavigation"],
    ])
    expect(r.toolResults).toEqual([
      expect.objectContaining({ type: "tool-result", step: 0, toolName: "searchMedia" }),
      expect.objectContaining({ type: "tool-error", step: 1, toolName: "getMediaDetails", error: "db down" }),
    ])
    expect(r.citedMediaIds).toEqual(["m-1"])
    // The final step's response messages accumulate every step.
    expect(r.modelMessages).toHaveLength(3)
    expect(r.usage).toMatchObject({ inputTokens: 2200, uncachedInputTokens: 200, cachedInputTokens: 2000, cacheWriteInputTokens: 0 })
    expect(r.finishReason).toBe("tool-calls")
  })

  it("sums completed steps' usage for an interrupted turn", () => {
    const r = buildAssistantTurnRecord({ steps: [searchStep], kind: "aborted" })
    expect(r.finishReason).toBe("aborted")
    expect(r.usage).toMatchObject({ inputTokens: 1100, outputTokens: 20, uncachedInputTokens: 100 })
    expect(buildAssistantTurnRecord({ steps: [], kind: "error" })).toMatchObject({
      content: "",
      modelMessages: [],
      finishReason: "error",
      usage: { inputTokens: null },
    })
  })

  it("extracts ids from rails and details, never off-catalogue cards", () => {
    expect(
      extractCitedMediaIds([
        { output: { results: [{ id: "a" }, { id: "tmdb-1" }, { id: 3 }] } },
        { output: { found: true, id: "b" } },
        { output: "texte" },
        {},
      ]),
    ).toEqual(["a", "b"])
  })
})

describe("createTurnRecorder — settles a turn exactly once", () => {
  it("records a finished turn once, whatever comes after", async () => {
    const settle = vi.fn()
    const rec = createTurnRecorder(settle)
    rec.onStepFinish(searchStep)
    await rec.finish({ steps: [searchStep, answerStep], totalUsage: usage(1, 1, 1, 1) as never, finishReason: "stop" })
    await rec.end()
    await rec.disconnect()
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle.mock.calls[0][1]).toBe("finished")
  })

  it("logs a disconnected browser with the steps completed so far", async () => {
    const settle = vi.fn()
    const rec = createTurnRecorder(settle)
    rec.onStepFinish(searchStep)
    await rec.disconnect()
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ content: "Je regarde.", finishReason: "client_disconnected" }), "client_disconnected")
  })

  it("logs a turn that died before onFinish as an error", async () => {
    const settle = vi.fn()
    const rec = createTurnRecorder(settle)
    rec.onError(new Error("MissingToolResultsError"))
    await rec.end()
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ finishReason: "error" }), "error")
  })

  it("wins the race between a fire-and-forget onAbort and the stream end", async () => {
    const settle = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    const rec = createTurnRecorder(settle)
    const aborting = rec.abort({ steps: [searchStep] })
    await rec.end()
    await aborting
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle.mock.calls[0]).toEqual([expect.objectContaining({ finishReason: "aborted" }), "aborted"])
  })
})
