import { describe, it, expect, vi, beforeEach } from "vitest"
import { validateEnv } from "../env"

describe("validateEnv", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("throws when required vars are missing", () => {
    delete process.env.DATABASE_URL
    delete process.env.AUTH_SECRET

    expect(() => validateEnv()).toThrow("Variables d'environnement manquantes")
  })

  it("does not throw when all required vars are set", () => {
    process.env.DATABASE_URL = "postgresql://localhost"
    process.env.AUTH_SECRET = "secret"

    expect(() => validateEnv()).not.toThrow()
  })

  it("lists all missing vars in error message", () => {
    delete process.env.DATABASE_URL
    delete process.env.AUTH_SECRET

    try {
      validateEnv()
    } catch (e) {
      const message = (e as Error).message
      expect(message).toContain("DATABASE_URL")
      expect(message).toContain("AUTH_SECRET")
    }
  })
})
