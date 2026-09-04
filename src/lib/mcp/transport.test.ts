// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findFirst: vi.fn().mockResolvedValue(null) }, $queryRaw: vi.fn().mockResolvedValue([]) } }))
import { POST } from "@/app/api/mcp/[transport]/route"

async function rpc(id: number, method: string, params: Record<string, unknown>) {
  const response = await POST(new Request("http://localhost/api/mcp/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
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
    expect(initialized.result.serverInfo.version).toBe("1.1.0")
    const listed = await rpc(2, "tools/list", {})
    expect(listed.result.tools).toHaveLength(3)
    for (const tool of listed.result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true)
      expect(tool.outputSchema).toBeDefined()
    }
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
