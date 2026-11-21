import { beforeEach, describe, expect, it, vi } from "vitest"

const findMany = vi.fn()
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findMany: (...a: unknown[]) => findMany(...a) } } }))

import { getCollectionWithItems } from "../collections"
import { COLLECTIONS } from "../collections-data"

describe("dynamic collections", () => {
  beforeEach(() => findMany.mockReset().mockResolvedValue([]))

  it("only lists enriched titles (a provisional age can't headline a « meilleurs films » list)", async () => {
    const dynamic = COLLECTIONS.filter((c) => !c.curatedIds && c.query)
    expect(dynamic.length).toBeGreaterThan(0)
    for (const c of dynamic) {
      findMany.mockClear()
      await getCollectionWithItems(c.id)
      expect(findMany).toHaveBeenCalledTimes(1)
      expect(findMany.mock.calls[0][0].where.isEnriched, c.id).toBe(true)
    }
  })
})

describe("curated collection comments", () => {
  it("never hard-code an age next to an id (the age is read live and the comment would rot)", async () => {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const src = readFileSync(join(process.cwd(), "src/lib/collections-data.ts"), "utf8")
    const idComments = src.split("\n").filter((l) => /"[0-9a-f-]{36}",\s*\/\//.test(l))
    expect(idComments.length).toBeGreaterThan(100)
    for (const line of idComments) expect(line).not.toMatch(/\d+\s*ans\b/)
  })
})
