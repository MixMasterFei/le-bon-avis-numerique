// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

// Every statement of the deletion must run on the transaction client `tx`:
// the top-level client only opens the transaction. Prisma rolls the whole
// transaction back when the callback throws, so "all through tx" + "errors
// propagate" is what makes the deletion all-or-nothing. (Checked for real on
// a throwaway PostgreSQL too: see the F01 hand-over in docs/agents/guardian.md.)
const { db, tx } = vi.hoisted(() => {
  const delegate = () => ({
    findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), delete: vi.fn(),
  })
  return {
    db: {
      $transaction: vi.fn(),
      review: delegate(), recoClick: delegate(), nlSearchQuery: delegate(),
      verificationToken: delegate(), user: delegate(), mediaItem: delegate(),
    },
    tx: {
      $queryRaw: vi.fn(),
      review: delegate(), recoClick: delegate(), nlSearchQuery: delegate(),
      verificationToken: delegate(), user: delegate(), mediaItem: delegate(),
    },
  }
})
vi.mock("@/lib/prisma", () => ({ prisma: db }))

import { deleteUserAccount, ERASED_QUERY_HASH, USER_REFERENCES } from "@/lib/account-deletion"

const ACCOUNT = { id: "parent-a", email: "parent-a@example.test" }

type Where = { mediaId?: string } & Record<string, unknown>

beforeEach(() => {
  vi.resetAllMocks()
  db.$transaction.mockImplementation(async (run: (client: typeof tx) => unknown) => run(tx))
  tx.$queryRaw.mockResolvedValue([ACCOUNT])
  tx.review.findMany.mockImplementation(async ({ where }: { where: Where }) =>
    where.mediaId
      ? // recomputeCommunityAge: the suggestions that remain on that title
        [{ ageSuggestion: 10 }, { ageSuggestion: 12 }, { ageSuggestion: 14 }]
      : // the account's own reviews
        [
          { mediaId: "film-1", ageSuggestion: 6 },
          { mediaId: "film-1", ageSuggestion: 8 },
          { mediaId: "film-2", ageSuggestion: null },
        ])
  tx.review.deleteMany.mockResolvedValue({ count: 3 })
  tx.mediaItem.update.mockResolvedValue({})
  tx.recoClick.deleteMany.mockResolvedValue({ count: 7 })
  tx.nlSearchQuery.updateMany.mockResolvedValue({ count: 2 })
  tx.nlSearchQuery.deleteMany.mockResolvedValue({ count: 5 })
  tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  tx.user.delete.mockResolvedValue({ id: ACCOUNT.id })
})

/** Every call made on the transaction client, in order, as "delegate.method". */
function txCalls(): { name: string; order: number; args: unknown[] }[] {
  const calls: { name: string; order: number; args: unknown[] }[] = []
  for (const [model, delegate] of Object.entries(tx)) {
    if (typeof delegate === "function") {
      const mock = vi.mocked(delegate)
      mock.mock.calls.forEach((args, i) => calls.push({ name: model, order: mock.mock.invocationCallOrder[i], args }))
      continue
    }
    for (const [method, fn] of Object.entries(delegate)) {
      const mock = vi.mocked(fn)
      mock.mock.calls.forEach((args, i) =>
        calls.push({ name: `${model}.${method}`, order: mock.mock.invocationCallOrder[i], args }))
    }
  }
  return calls.sort((a, b) => a.order - b.order)
}

describe("deleteUserAccount", () => {
  it("locks the account row, cleans what the cascade misses, then deletes the account — in one transaction", async () => {
    const summary = await deleteUserAccount(ACCOUNT.id)

    expect(db.$transaction).toHaveBeenCalledOnce()
    const names = txCalls().map((c) => c.name)
    expect(names[0]).toBe("$queryRaw")
    expect(names.at(-1)).toBe("user.delete")
    const [sql, ...params] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    expect(sql.join("?")).toMatch(/FROM "users" WHERE "id" = \? FOR UPDATE/)
    expect(params).toEqual([ACCOUNT.id])

    expect(summary).toEqual({
      reviews: 3,
      communityAgesRecomputed: 1,
      recoClicks: 7,
      searchesDeleted: 5,
      searchCostRowsAnonymised: 2,
      verificationTokens: 1,
    })
  })

  it("deletes every review the account wrote, including those in its children's names", async () => {
    await deleteUserAccount(ACCOUNT.id)
    const scope = { OR: [{ userId: ACCOUNT.id }, { familyMember: { userId: ACCOUNT.id } }] }
    expect(tx.review.deleteMany).toHaveBeenCalledWith({ where: scope })
    expect(tx.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: scope }))
  })

  it("recomputes the community age only of titles a deleted review suggested an age for", async () => {
    await deleteUserAccount(ACCOUNT.id)
    expect(tx.mediaItem.update).toHaveBeenCalledOnce()
    expect(tx.mediaItem.update).toHaveBeenCalledWith({ where: { id: "film-1" }, data: { communityAgeRec: 12 } })
  })

  it("deletes the account's recommendation clicks (no foreign key would)", async () => {
    await deleteUserAccount(ACCOUNT.id)
    expect(tx.recoClick.deleteMany).toHaveBeenCalledWith({ where: { userId: ACCOUNT.id } })
  })

  it("keeps billable searches only as anonymous cost counters and deletes every other search", async () => {
    await deleteUserAccount(ACCOUNT.id)
    expect(tx.nlSearchQuery.updateMany).toHaveBeenCalledWith({
      where: { userId: ACCOUNT.id, status: "llm" },
      data: { userId: null, query: "", queryHash: ERASED_QUERY_HASH, intent: Prisma.DbNull },
    })
    expect(tx.nlSearchQuery.deleteMany).toHaveBeenCalledWith({ where: { userId: ACCOUNT.id } })
    // Anonymise first, or the delete would also take the counters.
    expect(tx.nlSearchQuery.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.nlSearchQuery.deleteMany.mock.invocationCallOrder[0])
    // The placeholder can never collide with a real sha256 cache key.
    expect(ERASED_QUERY_HASH).not.toMatch(/^[0-9a-f]{64}$/)
  })

  it("deletes pending verification and password-reset links of the account's e-mail", async () => {
    await deleteUserAccount(ACCOUNT.id)
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { identifier: { equals: ACCOUNT.email, mode: "insensitive" } },
          { identifier: { equals: `reset:${ACCOUNT.email}`, mode: "insensitive" } },
        ],
      },
    })
  })

  it("scopes every write to this account — never an unfiltered delete or update", async () => {
    await deleteUserAccount(ACCOUNT.id)
    const writes = txCalls().filter((c) => /\.(deleteMany|updateMany|delete)$/.test(c.name))
    expect(writes.length).toBeGreaterThanOrEqual(6)
    for (const write of writes) {
      const where = JSON.stringify((write.args[0] as { where?: unknown }).where ?? {})
      expect(where, write.name).toMatch(new RegExp(`${ACCOUNT.id}|${ACCOUNT.email}`))
    }
    // Only the top-level client's $transaction is ever used.
    for (const [name, delegate] of Object.entries(db)) {
      if (name === "$transaction") continue
      for (const fn of Object.values(delegate as Record<string, ReturnType<typeof vi.fn>>)) {
        expect(fn).not.toHaveBeenCalled()
      }
    }
  })

  it("returns null and writes nothing when the account does not exist", async () => {
    tx.$queryRaw.mockResolvedValue([])
    expect(await deleteUserAccount("gone")).toBeNull()
    expect(txCalls().map((c) => c.name)).toEqual(["$queryRaw"])
  })

  it.each([
    "review.deleteMany",
    "recoClick.deleteMany",
    "nlSearchQuery.updateMany",
    "verificationToken.deleteMany",
    "user.delete",
  ])("lets a failure at %s propagate out of the transaction (so it rolls back) and run nothing after it", async (step) => {
    const [model, method] = step.split(".")
    const delegates = tx as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
    delegates[model][method].mockRejectedValue(new Error("simulated failure"))

    await expect(deleteUserAccount(ACCOUNT.id)).rejects.toThrow("simulated failure")

    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(txCalls().map((c) => c.name).at(-1)).toBe(step)
  })
})

// ── Every reference to an account in the schema has a decision ─────────────

const SCHEMA = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8")

interface Ref { key: string; relation: boolean; onDelete: string | null; target: string | null }

/** References to an account: relations to User or FamilyMember, `userId`
 *  scalars (with or without a relation), and "<something>By" staff ids. */
function schemaReferences(): Ref[] {
  const refs = new Map<string, Ref>()
  for (const [, model, body] of SCHEMA.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    for (const line of body.split("\n")) {
      const field = line.match(/^\s+(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/)
      if (!field) continue
      const [, name, type, modifier, rest] = field
      if ((type === "User" || type === "FamilyMember") && modifier !== "[]" && rest.includes("@relation(")) {
        const fk = rest.match(/fields:\s*\[(\w+)\]/)?.[1]
        if (!fk) continue
        // Prisma's default for an optional relation is SetNull.
        const onDelete = rest.match(/onDelete:\s*(\w+)/)?.[1] ?? (modifier === "?" ? "SetNull" : "Restrict")
        refs.set(`${model}.${fk}`, { key: `${model}.${fk}`, relation: true, onDelete, target: type })
      } else if ((name === "userId" || /^[a-z]+By$/.test(name)) && type === "String") {
        const key = `${model}.${name}`
        if (!refs.has(key)) refs.set(key, { key, relation: false, onDelete: null, target: null })
      }
    }
  }
  return [...refs.values()]
}

describe("USER_REFERENCES covers every account reference in prisma/schema.prisma", () => {
  const refs = schemaReferences()
  const decided = USER_REFERENCES as Record<string, string>

  it("finds the references the schema is known to hold (guards the parser itself)", () => {
    const keys = refs.map((r) => r.key)
    expect(keys).toContain("Review.userId")
    expect(keys).toContain("RecoClick.userId")
    expect(keys).toContain("MediaReaction.familyMemberId")
    expect(keys).toContain("MediaCorrection.reviewedBy")
    expect(refs.length).toBeGreaterThan(25)
  })

  it("has a decision for every reference, and no decision for a reference that no longer exists", () => {
    const keys = refs.map((r) => r.key).sort()
    const undecided = keys.filter((k) => !(k in decided))
    const stale = Object.keys(decided).filter((k) => !keys.includes(k))
    expect(undecided, "new reference to an account: decide what deletion does with it (src/lib/account-deletion.ts)").toEqual([])
    expect(stale, "USER_REFERENCES lists a field the schema no longer has").toEqual([])
  })

  it("cascades every relation to User: the database never keeps a deleted account's rows", () => {
    const toUser = refs.filter((r) => r.target === "User")
    expect(toUser.length).toBeGreaterThan(20)
    for (const ref of toUser) expect(ref.onDelete, ref.key).toBe("Cascade")
  })

  it("marks as 'cascade' only what really cascades, from the account or from a family member", () => {
    for (const ref of refs.filter((r) => decided[r.key] === "cascade")) {
      expect(ref.relation, `${ref.key} has no foreign key to cascade from`).toBe(true)
      expect(ref.onDelete, ref.key).toBe("Cascade")
    }
    expect(refs.find((r) => r.key === "FamilyMember.userId")?.onDelete).toBe("Cascade")
  })
})
