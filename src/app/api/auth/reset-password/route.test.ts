// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createSessionVersion, validateSessionToken } from "@/lib/auth-session"

const { db, tx, hash } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() }, $transaction: vi.fn() },
  tx: {
    verificationToken: { findUnique: vi.fn(), deleteMany: vi.fn() },
    user: { update: vi.fn() },
  },
  hash: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ prisma: db }))
vi.mock("bcryptjs", () => ({ hash }))

const account = {
  id: "parent-a", email: "parent@example.test", password: "old-hash",
  createdAt: new Date("2026-01-01T12:00:00Z"), role: "USER", name: "Parent",
  image: null, onboardingCompleted: true,
}

function request(body: unknown = { token: "reset-token", password: "new-password" }) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST", body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-only")
  hash.mockResolvedValue("new-hash")
  db.user.findUnique.mockResolvedValue({ ...account })
  db.$transaction.mockImplementation(async (callback) => callback(tx))
  tx.verificationToken.findUnique.mockResolvedValue({
    identifier: `reset:${account.email}`, token: "reset-token", expires: new Date(Date.now() + 60_000),
  })
  tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  tx.user.update.mockImplementation(async ({ data }) => {
    db.user.findUnique.mockResolvedValue({ ...account, password: data.password })
    return { ...account, password: data.password }
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("password reset", () => {
  it("consumes the token and replaces the password in one transaction, revoking the old JWT", async () => {
    const oldToken = { id: account.id, role: account.role, authVersion: await createSessionVersion(account) }
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(hash).toHaveBeenCalledWith("new-password", 12)
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(tx.user.update).toHaveBeenCalledWith({ where: { email: account.email }, data: { password: "new-hash" } })
    expect(await validateSessionToken({ token: oldToken, user: account, account: null })).toBeNull()
  })

  it("does not reset when another request has already consumed the token", async () => {
    tx.verificationToken.deleteMany.mockResolvedValue({ count: 0 })
    expect((await POST(request())).status).toBe(400)
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it("rejects a missing token", async () => {
    tx.verificationToken.findUnique.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(400)
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it("rejects an expired reset token", async () => {
    tx.verificationToken.findUnique.mockResolvedValue({
      identifier: `reset:${account.email}`, token: "reset-token", expires: new Date(Date.now() - 1),
    })
    expect((await POST(request())).status).toBe(400)
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it("cannot use an email-verification token to reset a password", async () => {
    tx.verificationToken.findUnique.mockResolvedValue({
      identifier: account.email, token: "verification-token", expires: new Date(Date.now() + 60_000),
    })
    expect((await POST(request())).status).toBe(400)
    expect(tx.verificationToken.deleteMany).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it.each([
    { token: "reset-token", password: "short" },
    { token: "reset-token", password: 12345678 },
    { token: [], password: "new-password" },
  ])("validates token/password inputs before hashing or writing", async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(hash).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("returns no success when the transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    db.$transaction.mockRejectedValue(new Error("transaction rolled back"))
    expect((await POST(request())).status).toBe(500)
  })
})
