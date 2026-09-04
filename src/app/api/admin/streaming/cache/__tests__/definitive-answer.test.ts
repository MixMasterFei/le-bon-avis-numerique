import { describe, expect, it } from "vitest"
import { isDefinitiveTmdbAnswer } from "../route"

// ---------------------------------------------------------------------------
// The rule that decides whether a title leaves the streaming queue. Getting it
// wrong in either direction is costly:
//   too narrow  → dead ids are re-fetched for ever and the backlog never drains
//                 (the bug this replaced: a steady {"404": 4} on every batch)
//   too wide    → a rate-limited or briefly-down TMDB silently marks thousands
//                 of titles "checked", and their platform badges go stale for a
//                 full freshness window.
// ---------------------------------------------------------------------------

describe("isDefinitiveTmdbAnswer", () => {
  it("treats 404 as final — the id is gone or was merged", () => {
    expect(isDefinitiveTmdbAnswer(404)).toBe(true)
  })

  it("treats the other client errors as final too", () => {
    for (const s of [400, 401, 403, 422]) expect(isDefinitiveTmdbAnswer(s)).toBe(true)
  })

  it("never treats 429 as final — it means ask again later", () => {
    expect(isDefinitiveTmdbAnswer(429)).toBe(false)
  })

  it("never treats a server error as final", () => {
    for (const s of [500, 502, 503, 504]) expect(isDefinitiveTmdbAnswer(s)).toBe(false)
  })

  it("does not treat success as an error verdict at all", () => {
    for (const s of [200, 204, 304]) expect(isDefinitiveTmdbAnswer(s)).toBe(false)
  })
})
