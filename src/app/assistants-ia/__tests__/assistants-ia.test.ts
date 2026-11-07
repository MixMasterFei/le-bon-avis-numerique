// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

// The page documents a live server contract. These tests make the doc fail
// the build the day it drifts from the server — and keep the one thing it
// must never say (which AI Totem uses internally) out of it.

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findFirst: vi.fn().mockResolvedValue(null) }, $queryRaw: vi.fn().mockResolvedValue([]) },
}))
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: vi.fn().mockResolvedValue([]) } }))

import { POST } from "@/app/api/mcp/[transport]/route"
import { isAiConnectorsPagePublic } from "@/lib/ai-connectors-flag"
import { staticPageEntries } from "@/lib/sitemap"
import * as content from "../assistants-ia.data"

async function rpc(url: string, id: number, method: string, params: Record<string, unknown>) {
  const response = await POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  )
  expect(response.status).toBe(200)
  const body = await response.text()
  const data = body.split("\n").find((line) => line.startsWith("data: "))
  return JSON.parse(data ? data.slice(6) : body)
}

afterEach(() => {
  delete process.env.AI_CONNECTORS_PAGE_PUBLIC
})

describe("/assistants-ia gate", () => {
  it("is closed by default and opens only on the explicit flag", () => {
    expect(isAiConnectorsPagePublic()).toBe(false)
    process.env.AI_CONNECTORS_PAGE_PUBLIC = "1"
    expect(isAiConnectorsPagePublic()).toBe(false)
    process.env.AI_CONNECTORS_PAGE_PUBLIC = "true"
    expect(isAiConnectorsPagePublic()).toBe(true)
  })

  it("stays out of the sitemap until it is public", () => {
    const urls = () => staticPageEntries(new Date()).map((e) => e.url)
    expect(urls().some((u) => u.endsWith("/assistants-ia"))).toBe(false)
    process.env.AI_CONNECTORS_PAGE_PUBLIC = "true"
    expect(urls().some((u) => u.endsWith("/assistants-ia"))).toBe(true)
  })
})

describe("/assistants-ia content matches the live server", () => {
  it("documents the URL the server actually answers on", async () => {
    const init = await rpc(content.CONNECTOR_URL, 1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "doc-test", version: "1" },
    })
    expect(init.result.serverInfo.name).toBe("totem-avise")
  })

  it("documents exactly the tools the server lists, all read-only", async () => {
    const listed = await rpc(content.CONNECTOR_URL, 2, "tools/list", {})
    const served = listed.result.tools.map((t: { name: string }) => t.name).sort()
    expect(content.TOOLS.map((t) => t.name).sort()).toEqual(served)
    // The page promises « lecture seule »: every tool must carry the hint.
    for (const tool of listed.result.tools) expect(tool.annotations.readOnlyHint).toBe(true)
  })

  it("gives five example questions and the connector URL in every setup guide", () => {
    expect(content.EXAMPLE_QUESTIONS).toHaveLength(5)
    expect(content.SETUP_GUIDES.map((g) => g.id)).toEqual(["claude", "le-chat", "chatgpt"])
    for (const guide of content.SETUP_GUIDES) {
      expect(guide.steps.some((s) => s.includes(content.CONNECTOR_URL))).toBe(true)
    }
  })

  it("never says which AI Totem uses internally", () => {
    const text = JSON.stringify(content)
    // Assistant names (Claude, Le Chat, ChatGPT) are the documented
    // exception; vendors and internal model names are not.
    expect(text).not.toMatch(/OpenAI|Anthropic|\bGPT-?\d|gpt-|Sonnet|Haiku|Opus|DeepSeek/)
  })
})
