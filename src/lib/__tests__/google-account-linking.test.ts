// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Profile } from "next-auth"
import { handleGoogleAccountLinking, hasAuthoritativeGoogleEmail } from "../google-account-linking"

const { db, tx, getAuthenticatedUserId } = vi.hoisted(() => ({
  db: { account: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, $transaction: vi.fn() },
  tx: { account: { create: vi.fn() }, user: { update: vi.fn() } },
  getAuthenticatedUserId: vi.fn(),
}))
vi.mock("../db", () => ({ prisma: db }))

const profile = { sub: "google-subject", email: "parent@gmail.com", email_verified: true }
const existingUser = { id: "parent-a", email: profile.email, image: null, emailVerified: null, accounts: [] }

function signIn(overrides: { profile?: Profile; email?: string } = {}) {
  return handleGoogleAccountLinking({
    user: { id: "provider-user", email: overrides.email ?? profile.email, name: "Parent", role: "USER" },
    account: { provider: "google", providerAccountId: profile.sub, type: "oidc" },
    profile: overrides.profile ?? profile,
    getAuthenticatedUserId,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  db.account.findUnique.mockResolvedValue(null)
  db.user.findUnique.mockResolvedValue({ ...existingUser })
  db.$transaction.mockImplementation(async (callback) => callback(tx))
  getAuthenticatedUserId.mockResolvedValue(null)
})

describe("Google email authority", () => {
  it.each([
    { email: "parent@gmail.com", email_verified: true },
    { email: "parent@school.fr", email_verified: true, hd: "school.fr" },
  ])("accepts verified Gmail and Workspace claims", (claims) => {
    expect(hasAuthoritativeGoogleEmail(claims)).toBe(true)
  })

  it.each([
    { email: "parent@gmail.com", email_verified: false },
    { email: "parent@gmail.com" },
    { email: "parent@yahoo.fr", email_verified: true },
    { email: "parent@gmail.com.evil.test", email_verified: true },
    { email: "parent@school.fr", email_verified: true, hd: "" },
    { email: "parent@school.fr", email_verified: false, hd: "school.fr" },
  ])("rejects claims that do not establish Google authority", (claims) => {
    expect(hasAuthoritativeGoogleEmail(claims)).toBe(false)
  })
})

describe("Google account linking", () => {
  it("allows the exact previously linked subject without relinking by changed email", async () => {
    db.account.findUnique.mockResolvedValue({ userId: "parent-a" })
    expect(await signIn({ profile: { ...profile, email: "changed@external.test", email_verified: false } })).toBe(true)
    expect(db.account.findUnique).toHaveBeenCalledWith({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
      select: { userId: true },
    })
    expect(db.user.findUnique).not.toHaveBeenCalled()
    expect(tx.account.create).not.toHaveBeenCalled()
  })

  it("auto-links Gmail and discards an unverified registrant's password", async () => {
    db.user.findUnique.mockResolvedValue({ ...existingUser, password: "attacker-chosen-password-hash" })
    expect(await signIn()).toBe(true)
    expect(tx.account.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "parent-a", providerAccountId: profile.sub }) })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "parent-a" }, data: { emailVerified: expect.any(Date), password: null },
    })
  })

  it("preserves the password of an already email-verified credentials account", async () => {
    db.user.findUnique.mockResolvedValue({ ...existingUser, emailVerified: new Date(), password: "owner-password-hash" })
    expect(await signIn()).toBe(true)
    expect(tx.account.create).toHaveBeenCalledOnce()
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it("auto-links a verified Workspace identity", async () => {
    const email = "parent@school.fr"
    expect(await signIn({ email, profile: { ...profile, email, hd: "school.fr" } })).toBe(true)
    expect(tx.account.create).toHaveBeenCalledOnce()
  })

  it("requires the existing login method for verified third-party email collisions", async () => {
    const email = "parent@yahoo.fr"
    expect(await signIn({ email, profile: { ...profile, email } })).toBe("/connexion?error=OAuthAccountNotLinked")
    expect(tx.account.create).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it("allows Auth.js to link a third-party mailbox after the existing owner signs in", async () => {
    getAuthenticatedUserId.mockResolvedValue("parent-a")
    const email = "parent@yahoo.fr"
    expect(await signIn({ email, profile: { ...profile, email } })).toBe(true)
    expect(tx.account.create).not.toHaveBeenCalled()
  })

  it("does not use another user's active session to link an existing account", async () => {
    getAuthenticatedUserId.mockResolvedValue("parent-b")
    expect(await signIn()).toBe("/connexion?error=OAuthAccountNotLinked")
    expect(tx.account.create).not.toHaveBeenCalled()
  })

  it("rejects unverified new Google identities", async () => {
    expect(await signIn({ profile: { ...profile, email_verified: false } })).toBe(false)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it("does not replace a different Google subject already attached to the email", async () => {
    db.user.findUnique.mockResolvedValue({ ...existingUser, accounts: [{ provider: "google", providerAccountId: "other-subject" }] })
    expect(await signIn()).toBe("/connexion?error=OAuthAccountNotLinked")
    expect(tx.account.create).not.toHaveBeenCalled()
  })

  it("leaves new verified users without an email collision to Auth.js", async () => {
    db.user.findUnique.mockResolvedValue(null)
    expect(await signIn()).toBe(true)
    expect(tx.account.create).not.toHaveBeenCalled()
  })

  it("rejects mismatched subject or email claims", async () => {
    expect(await signIn({ profile: { ...profile, sub: "wrong-subject" } })).toBe(false)
    expect(await signIn({ profile: { ...profile, email: "other@gmail.com" } })).toBe(false)
    expect(tx.account.create).not.toHaveBeenCalled()
  })
})
