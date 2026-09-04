// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { encode, type JWT } from "next-auth/jwt"
import { createSessionVersion, decodeSessionToken, validateSessionToken } from "../auth-session"

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock("../db", () => ({ prisma: { user: { findUnique } } }))

const user = {
  id: "parent-a",
  email: "parent@example.test",
  password: "stored-bcrypt-hash",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  role: "ADMIN",
  name: "Parent",
  image: null,
  onboardingCompleted: false,
}

type CallbackArgs = Parameters<typeof validateSessionToken>[0]
function check(token: JWT, options: Partial<CallbackArgs> = {}) {
  return validateSessionToken({ token, user: { id: user.id, role: "USER" }, account: null, ...options })
}

async function signIn(provider = "credentials") {
  const token = await check({ id: user.id, role: "USER" }, {
    trigger: "signIn",
    user: { id: user.id, role: "USER", authVersion: await createSessionVersion(user) },
    account: { provider, type: provider === "credentials" ? "credentials" : "oauth", providerAccountId: user.id },
  })
  expect(token).not.toBeNull()
  return token as JWT
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-only")
  findUnique.mockReset().mockResolvedValue({ ...user })
})
afterEach(() => vi.unstubAllEnvs())

describe("database-validated JWT sessions", () => {
  it("issues a credential-bound session without exposing the password hash", async () => {
    const token = await signIn()
    expect(token.authVersion).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(token)).not.toContain(user.password)
    expect(token.role).toBe("ADMIN")
    expect(await check(token)).toMatchObject({ id: user.id, role: "ADMIN" })
  })

  it("immediately applies an admin demotion without a client session update", async () => {
    const token = await signIn()
    findUnique.mockResolvedValue({ ...user, role: "USER" })
    expect(await check(token)).toMatchObject({ role: "USER" })
  })

  it("rejects every old session after the password changes", async () => {
    const first = await signIn()
    const second = await signIn()
    findUnique.mockResolvedValue({ ...user, password: "new-password-hash" })
    expect(await check(first)).toBeNull()
    expect(await check(second)).toBeNull()
  })

  it("does not let updateSession refresh a revoked session", async () => {
    const token = await signIn()
    const changedUser = { ...user, password: "new-password-hash" }
    findUnique.mockResolvedValue(changedUser)
    expect(await check(token, {
      trigger: "update",
      session: { authVersion: await createSessionVersion(changedUser), role: "ADMIN" },
    })).toBeNull()
  })

  it("requires pre-deployment JWTs to sign in once, including explicit updates", async () => {
    expect(await check({ id: user.id, role: "ADMIN" })).toBeNull()
    expect(await check({ id: user.id, role: "ADMIN" }, { trigger: "update" })).toBeNull()
  })

  it("keeps sessions valid when onboarding, name or image change", async () => {
    const token = await signIn()
    const version = token.authVersion
    findUnique.mockResolvedValue({ ...user, name: null, image: "new-image", onboardingCompleted: true })
    expect(await check(token, { trigger: "update" })).toMatchObject({
      authVersion: version, name: null, picture: "new-image", onboardingCompleted: true,
    })
  })

  it("revokes deleted accounts and does not recreate them from token claims", async () => {
    const token = await signIn()
    findUnique.mockResolvedValue(null)
    expect(await check(token)).toBeNull()
  })

  it("never returns a stale privileged token when the database is unavailable", async () => {
    const token = await signIn()
    findUnique.mockRejectedValue(new Error("database unavailable"))
    await expect(check(token)).rejects.toThrow("database unavailable")
  })

  it("supports a new Google-only account with no password", async () => {
    findUnique.mockResolvedValue({ ...user, password: null, role: "USER" })
    const token = await check({ id: "", role: "USER" }, {
      trigger: "signUp",
      user: { id: user.id, role: "USER" },
      account: { provider: "google", type: "oauth", providerAccountId: "google-subject" },
    })
    expect(token).toMatchObject({ id: user.id, role: "USER" })
    expect(await check(token as JWT)).toMatchObject({ id: user.id })
  })

  it("binds linked Google sessions to the same password reset state", async () => {
    const token = await signIn("google")
    findUnique.mockResolvedValue({ ...user, password: "reset-hash" })
    expect(await check(token)).toBeNull()
  })

  it("rejects credentials verified just before a concurrent password reset", async () => {
    const version = await createSessionVersion(user)
    findUnique.mockResolvedValue({ ...user, password: "reset-hash" })
    expect(await check({ id: user.id, role: "USER" }, {
      trigger: "signIn",
      user: { id: user.id, role: "USER", authVersion: version },
      account: { provider: "credentials", type: "credentials", providerAccountId: user.id },
    })).toBeNull()
  })

  it("validates the direct JWT decode path used by OAuth account linking", async () => {
    const token = await signIn()
    const params = { secret: "test-auth-secret-only", salt: "authjs.session-token" }
    const encoded = await encode({ ...params, token })
    expect(await decodeSessionToken({ ...params, token: encoded })).toMatchObject({ id: user.id })
    findUnique.mockResolvedValue({ ...user, password: "reset-hash" })
    // Auth.js must not recover a user from this old cookie and link a new
    // attacker-controlled Google account to it after a password reset.
    expect(await decodeSessionToken({ ...params, token: encoded })).toBeNull()
  })

  it("does not accept legacy JWTs through the direct OAuth decode path", async () => {
    const params = { secret: "test-auth-secret-only", salt: "authjs.session-token" }
    const encoded = await encode({ ...params, token: { id: user.id, sub: user.id, role: "ADMIN" } })
    expect(await decodeSessionToken({ ...params, token: encoded })).toBeNull()
  })
})
