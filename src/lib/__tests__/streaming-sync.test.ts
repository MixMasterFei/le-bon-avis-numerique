import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// The property under test is narrow but load-bearing: these writes must NOT go
// through prisma.mediaItem.update(). MediaItem.updatedAt is `@updatedAt`, and
// sitemap.ts publishes it verbatim as each fiche's lastModified — so a
// streaming catch-up over the ~9 000 stale titles would announce 9 000
// freshly-modified pages to Google while nothing a reader sees had changed.
// A future refactor "simplifying" this back to the Prisma client would
// reintroduce that silently, hence the test.
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn().mockResolvedValue(1),
    mediaItem: { update: vi.fn(), updateMany: vi.fn() },
  },
}))

import { syncPlatforms, clearPlatforms, touchStreamingChecked } from "../streaming-sync"
import { prisma } from "@/lib/prisma"

const mocked = vi.mocked(prisma, true)

/** The SQL text of the last $executeRaw call, reassembled from the template. */
function lastSql(): string {
  const call = mocked.$executeRaw.mock.calls.at(-1)
  const strings = call?.[0] as unknown as TemplateStringsArray
  return strings.join(" ? ")
}

beforeEach(() => vi.clearAllMocks())

describe("streaming-sync — writes must not bump updatedAt", () => {
  it("syncPlatforms uses raw SQL, never the Prisma client", async () => {
    await syncPlatforms("m1", ["Netflix"])
    expect(mocked.$executeRaw).toHaveBeenCalledTimes(1)
    expect(mocked.mediaItem.update).not.toHaveBeenCalled()
  })

  it("writes both the badge and the rotation cursor, and nothing else", async () => {
    await syncPlatforms("m1", ["Netflix", "Max"])
    const sql = lastSql()
    expect(sql).toMatch(/UPDATE media_items/)
    expect(sql).toMatch(/platforms\s*=/)
    expect(sql).toMatch(/streaming_checked_at\s*=\s*now\(\)/)
    // The whole point: updated_at is left alone.
    expect(sql).not.toMatch(/updated_at/)
  })

  it("passes the platform list as a bound parameter, not interpolated text", async () => {
    await syncPlatforms("m1", ["Netflix"])
    const [, platforms, id] = mocked.$executeRaw.mock.calls.at(-1) as unknown as [
      TemplateStringsArray, string[], string,
    ]
    expect(platforms).toEqual(["Netflix"])
    expect(id).toBe("m1")
  })

  it("clearPlatforms empties the badge rather than deleting the row", async () => {
    await clearPlatforms("m1")
    const [, platforms] = mocked.$executeRaw.mock.calls.at(-1) as unknown as [
      TemplateStringsArray, string[],
    ]
    expect(platforms).toEqual([])
    expect(lastSql()).toMatch(/UPDATE media_items/)
  })

  it("touchStreamingChecked moves the cursor without touching platforms", async () => {
    await touchStreamingChecked("m1")
    const sql = lastSql()
    expect(sql).toMatch(/streaming_checked_at\s*=\s*now\(\)/)
    expect(sql).not.toMatch(/platforms/)
    expect(sql).not.toMatch(/updated_at/)
  })
})
