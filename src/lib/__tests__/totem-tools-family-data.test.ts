// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  familyFindMany: vi.fn(),
  reactionFindMany: vi.fn(),
  mediaFindMany: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: h.familyFindMany },
    mediaReaction: { findMany: h.reactionFindMany },
    mediaItem: { findMany: h.mediaFindMany },
  },
}))
vi.mock("@/lib/search-normalize", () => ({ matchMediaIdsByTitle: async () => [], matchMediaIdsByTheme: async () => [] }))
vi.mock("@/lib/totem/sanity-search", () => ({ searchPublishedBlogPosts: async () => [] }))

import { buildTotemTools } from "../totem/tools"

const opts = { toolCallId: "c", messages: [] }
type Exec = (input: unknown, o: typeof opts) => Promise<unknown>
const exec = (tools: ReturnType<typeof buildTotemTools>, name: keyof ReturnType<typeof buildTotemTools>, input: unknown) =>
  (tools[name].execute as unknown as Exec)(input, opts)

beforeEach(() => {
  vi.clearAllMocks()
  h.familyFindMany.mockResolvedValue([])
  h.reactionFindMany.mockResolvedValue([{ mediaId: "seen-1" }])
  h.mediaFindMany.mockResolvedValue([])
  vi.stubGlobal("fetch", h.fetch)
})

describe("household tools — the live path is unchanged by the bench hook", () => {
  it("anonymous: the auth-only tools answer not_logged_in without touching the DB or the API", async () => {
    const tools = buildTotemTools({ origin: "http://x", cookieHeader: null, userId: null })
    expect(await exec(tools, "getUserFamilyContext", {})).toMatchObject({ status: "not_logged_in" })
    expect(await exec(tools, "getFamilyFit", { mediaId: "m" })).toMatchObject({ status: "not_logged_in" })
    expect(h.familyFindMany).not.toHaveBeenCalled()
    expect(h.fetch).not.toHaveBeenCalled()
  })

  it("signed in: reads the user's own household, calls the family-fit API with their cookie, hides seen titles", async () => {
    const tools = buildTotemTools({ origin: "http://x", cookieHeader: "session=abc", userId: "user-1" })
    expect(await exec(tools, "getUserFamilyContext", {})).toMatchObject({ status: "no_family" })
    expect(h.familyFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, take: 10 }))

    h.fetch.mockResolvedValue({ ok: true, json: async () => ({ status: "ok", members: [] }) })
    await exec(tools, "getFamilyFit", { mediaId: "m 1" })
    expect(h.fetch).toHaveBeenCalledWith("http://x/api/media/m%201/family-fit", {
      headers: { cookie: "session=abc" },
      cache: "no-store",
    })

    await exec(tools, "searchMedia", { limit: 5 })
    expect(h.reactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyMember: { userId: "user-1" }, reaction: { in: expect.any(Array) } } }),
    )
    expect(h.mediaFindMany.mock.calls[0][0].where.NOT).toEqual({ id: { in: ["seen-1"] } })
  })

  it("the bench's household replaces those three reads, and only those", async () => {
    const familyData = {
      getSeenMediaIds: vi.fn(async () => new Set(["fixture-seen"])),
      getUserFamilyContext: vi.fn(async () => ({ status: "ok", members: [{ id: "eval-member-lea" }] })),
      getFamilyFit: vi.fn(async () => ({ status: "ok", members: [] })),
    }
    const tools = buildTotemTools({ origin: "http://x", cookieHeader: null, userId: "eval-bench-household", familyData })
    expect(await exec(tools, "getUserFamilyContext", {})).toMatchObject({ members: [{ id: "eval-member-lea" }] })
    await exec(tools, "getFamilyFit", { mediaId: "m" })
    await exec(tools, "searchMedia", { limit: 5 })
    expect(familyData.getFamilyFit).toHaveBeenCalledWith("m")
    expect(h.mediaFindMany.mock.calls[0][0].where.NOT).toEqual({ id: { in: ["fixture-seen"] } })
    expect(h.familyFindMany).not.toHaveBeenCalled()
    expect(h.reactionFindMany).not.toHaveBeenCalled()
    expect(h.fetch).not.toHaveBeenCalled()
  })
})
