// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findFirst: vi.fn().mockResolvedValue(null) }, $queryRaw: vi.fn().mockResolvedValue([]), aiBotHit: { upsert: vi.fn().mockResolvedValue({}) } } }))
import { POST } from "@/app/api/mcp/[transport]/route"
import { prisma } from "@/lib/prisma"

async function rpc(id: number, method: string, params: Record<string, unknown>, userAgent = "vitest") {
  const response = await POST(new Request("http://localhost/api/mcp/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25", "User-Agent": userAgent },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }))
  const body = await response.text()
  expect(response.status).toBe(200)
  const data = body.split("\n").find((line) => line.startsWith("data: "))
  return JSON.parse(data ? data.slice(6) : body)
}

describe("MCP Streamable HTTP contract", () => {
  it("initializes and advertises structured, read-only tools", async () => {
    const initialized = await rpc(1, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } })
    expect(initialized.result.serverInfo).toMatchObject({ name: "totem-avise", title: "Totem Avisé", version: "1.2.0" })
    expect(initialized.result.serverInfo.icons[0].src).toMatch(/\/icon\.png$/)
    const listed = await rpc(2, "tools/list", {})
    expect(listed.result.tools).toHaveLength(3)
    for (const tool of listed.result.tools) {
      // Directory review: every tool has a title and the applicable hint.
      expect(tool.annotations.readOnlyHint).toBe(true)
      expect(tool.title).toBeTruthy()
      expect(tool.annotations.title).toBeTruthy()
      expect(tool.name.length).toBeLessThanOrEqual(64)
      expect(tool.outputSchema).toBeDefined()
    }
  })
  it("keeps descriptions and instructions free of promotion and language overrides", async () => {
    // Directory review rejects descriptions that promote products or override
    // the assistant's behaviour. The free account belongs in tool OUTPUTS.
    const initialized = await rpc(5, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } })
    const listed = await rpc(6, "tools/list", {})
    const texts: string[] = [initialized.result.instructions, ...listed.result.tools.map((t: { description: string }) => t.description)]
    for (const text of texts) {
      expect(text).not.toMatch(/inscription|compte famille|gratuit/i)
      expect(text).not.toMatch(/répondez en/i)
    }
  })
  it("treats a search with no match as an answer, not a failed call", async () => {
    const search = await rpc(7, "tools/call", { name: "search_media", arguments: { query: "zzzzzz" } })
    expect(search.result.isError).toBe(false)
    expect(search.result.structuredContent.status).toBe("not_found")
    const byTitle = await rpc(8, "tools/call", { name: "get_age_verdict", arguments: { title: "Titre inexistant" } })
    expect(byTitle.result.isError).toBe(false)
    expect(byTitle.result.structuredContent.status).toBe("not_found")
  })
  it("credits Totem Avisé in every answer, even an empty one", async () => {
    const search = await rpc(10, "tools/call", { name: "search_media", arguments: { query: "zzzzzz" } })
    expect(search.result.content[0].text).toContain("Source : Totem Avisé — ")
  })
  it("counts the call under the calling assistant, without the query", async () => {
    const upsert = vi.mocked(prisma.aiBotHit.upsert)
    upsert.mockClear()
    await rpc(11, "tools/call", { name: "search_media", arguments: { query: "Léa a peur" } }, "Claude-User/1.0")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(upsert).toHaveBeenCalledTimes(1)
    const where = upsert.mock.calls[0][0].where.day_bot_kind_surface
    expect(where).toMatchObject({ bot: "Claude-User", kind: "mcp", surface: "mcp-search_media" })
    expect(JSON.stringify(upsert.mock.calls)).not.toContain("Léa")
  })
  it("explains invalid arguments in French", async () => {
    const tooYoung = await rpc(9, "tools/call", { name: "recommend_for_age", arguments: { age: 2 } })
    expect(tooYoung.result.isError).toBe(true)
    expect(tooYoung.result.content[0].text).toContain("entre 3 et 16 ans")
  })
  it("returns recoverable structured errors for bad IDs and missing arguments", async () => {
    const missing = await rpc(3, "tools/call", { name: "get_age_verdict", arguments: { id: "movie:603oops" } })
    expect(missing.result.isError).toBe(true)
    expect(missing.result.structuredContent.status).toBe("not_found")
    const empty = await rpc(4, "tools/call", { name: "get_age_verdict", arguments: {} })
    expect(empty.result.structuredContent.status).toBe("invalid_input")
    expect(empty.result.content[0].text).toContain("Précisez")
  })
})
