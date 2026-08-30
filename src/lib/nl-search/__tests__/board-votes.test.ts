import { describe, expect, it } from "vitest"
import {
  clampDelta,
  isValidVoterToken,
  newVoterToken,
  sanitizeVoterName,
} from "../board-votes"

/**
 * The anonymous inputs of the ballot. Everything here arrives from people with
 * no account, so the clamps ARE the security model.
 */
describe("sanitizeVoterName", () => {
  it("keeps an ordinary first name", () => {
    expect(sanitizeVoterName("Mamie Jo")).toBe("Mamie Jo")
    expect(sanitizeVoterName("  Erwan  ")).toBe("Erwan")
  })

  it("rejects the too-short and the non-string", () => {
    expect(sanitizeVoterName("A")).toBeNull()
    expect(sanitizeVoterName("")).toBeNull()
    expect(sanitizeVoterName(42)).toBeNull()
    expect(sanitizeVoterName(null)).toBeNull()
  })

  it("strips markup and caps the length", () => {
    const clean = sanitizeVoterName("<script>alert(1)</script>Léo")
    expect(clean).not.toContain("<")
    expect(sanitizeVoterName("x".repeat(200))!.length).toBeLessThanOrEqual(24)
  })
})

describe("clampDelta", () => {
  it("accepts exactly one badge at a time, in either direction", () => {
    expect(clampDelta(1)).toBe(1)
    expect(clampDelta(-1)).toBe(-1)
    expect(clampDelta("1")).toBe(1)
  })

  it("rejects anything that would spend faster", () => {
    expect(clampDelta(3)).toBeNull()
    expect(clampDelta(0)).toBeNull()
    expect(clampDelta(-2)).toBeNull()
    expect(clampDelta("beaucoup")).toBeNull()
    expect(clampDelta(undefined)).toBeNull()
  })
})

describe("voter tokens", () => {
  it("issues 48-hex tokens that validate", () => {
    const token = newVoterToken()
    expect(isValidVoterToken(token)).toBe(true)
    expect(token).toHaveLength(48)
  })

  it("rejects foreign values so a crafted cookie is ignored", () => {
    expect(isValidVoterToken("abc")).toBe(false)
    expect(isValidVoterToken("Z".repeat(48))).toBe(false)
    expect(isValidVoterToken(undefined)).toBe(false)
    expect(isValidVoterToken(null)).toBe(false)
  })

  it("does not collide across a batch", () => {
    const tokens = new Set(Array.from({ length: 2000 }, () => newVoterToken()))
    expect(tokens.size).toBe(2000)
  })
})
