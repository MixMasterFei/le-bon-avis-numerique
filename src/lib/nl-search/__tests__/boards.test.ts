import { describe, expect, it } from "vitest"
import { newBoardId } from "../boards"

/**
 * The board id is the only thing between an unlisted board and the world:
 * /tableau/[id] has no other access check for a non-owner. These pin the
 * properties that keeps it unguessable and paste-safe.
 */
describe("newBoardId", () => {
  it("is 12 characters", () => {
    expect(newBoardId()).toHaveLength(12)
  })

  it("uses only URL-safe, unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      // No O/0 or I/l/1: these ids get read aloud and retyped.
      expect(newBoardId()).toMatch(/^[a-zA-Z2-9]{12}$/)
      expect(newBoardId()).not.toMatch(/[0O1lI]/)
    }
  })

  it("does not collide across a large batch", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newBoardId()))
    expect(ids.size).toBe(5000)
  })

  it("does not concentrate on a few leading characters", () => {
    // A broken modulo or a constant seed would show up here as a tiny alphabet.
    const leading = new Set(Array.from({ length: 500 }, () => newBoardId()[0]))
    expect(leading.size).toBeGreaterThan(20)
  })
})
