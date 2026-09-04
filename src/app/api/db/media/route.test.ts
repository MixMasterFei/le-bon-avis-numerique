// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

const { findMany, count, match } = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), match: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findMany, count } } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (callback: () => unknown) => callback() }))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: match }))
vi.mock("@/lib/media-route", () => ({ publicMediaWhere: { dataQualityScore: { gte: 30 } } }))

beforeEach(() => { vi.resetAllMocks(); findMany.mockResolvedValue([]); count.mockResolvedValue(0) })
function request(query: string) { return new NextRequest(`http://localhost/api/db/media?${query}`) }

describe("public media query boundaries", () => {
  it.each(["limit=-1", "limit=100000", "limit=20x", "page=0", "page=999999999999"])("rejects %s before touching the database", async (query) => {
    expect((await GET(request(query))).status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
    expect(match).not.toHaveBeenCalled()
  })
  it("permits valid pages beyond 100 with a bounded take", async () => {
    expect((await GET(request("page=222&limit=24"))).status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5304, take: 24 }))
  })
  it("does not drop age/search filters after a database error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    findMany.mockRejectedValue(new Error("database unavailable"))
    const response = await GET(request("maxAge=5"))
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(findMany).toHaveBeenCalledOnce()
    expect(findMany.mock.calls[0][0].where.expertAgeRec).toEqual({ gte: 0, lte: 5 })
    expect(await response.json()).not.toHaveProperty("items")
    error.mockRestore()
  })
  it("handles title-lookup errors without an unfiltered fallback", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    match.mockRejectedValue(new Error("lookup unavailable"))
    expect((await GET(request("q=Among+Us&maxAge=7"))).status).toBe(503)
    expect(findMany).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
