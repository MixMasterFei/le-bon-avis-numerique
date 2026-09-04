import { describe, expect, it } from "vitest"
import {
  PUBLIC_MEDIA_QUALITY_FLOOR,
  isPublicMedia,
  parseMediaRouteId,
  toMediaRouteId,
  NON_POSTER_URLS,
  publicMediaWhere,
} from "../media-route"

describe("media route id encode/parse", () => {
  it("lowercases the type and encodes the id", () => {
    expect(toMediaRouteId("MOVIE", "123")).toBe("movie:123")
  })

  it("round-trips a plain id", () => {
    const routeId = toMediaRouteId("TV", "abc")
    expect(parseMediaRouteId(routeId)).toEqual({ type: "TV", id: "abc" })
  })

  it("round-trips an id containing the separator", () => {
    const routeId = toMediaRouteId("GAME", "abc:def")
    expect(parseMediaRouteId(routeId)).toEqual({ type: "GAME", id: "abc:def" })
  })

  it("decodes a percent-encoded whole segment (Next.js param)", () => {
    expect(parseMediaRouteId("movie%3A123")).toEqual({ type: "MOVIE", id: "123" })
  })

  it("returns null type for an unknown type prefix", () => {
    expect(parseMediaRouteId("foo:1")).toEqual({ type: null, id: "1" })
  })

  it("returns null type when there is no separator", () => {
    expect(parseMediaRouteId("noseparator")).toEqual({ type: null, id: "noseparator" })
  })
})

describe("isPublicMedia — all four gates must pass", () => {
  const ok = { posterUrl: "https://x/p.jpg", dataQualityScore: 50, type: "MOVIE" as const }

  it("accepts a poster + quality >= floor + non-manga title", () => {
    expect(isPublicMedia(ok)).toBe(true)
  })

  it("treats the quality floor as inclusive (gte)", () => {
    expect(isPublicMedia({ ...ok, dataQualityScore: PUBLIC_MEDIA_QUALITY_FLOOR })).toBe(true)
    expect(isPublicMedia({ ...ok, dataQualityScore: PUBLIC_MEDIA_QUALITY_FLOOR - 1 })).toBe(false)
  })

  it("rejects a missing poster", () => {
    expect(isPublicMedia({ ...ok, posterUrl: null })).toBe(false)
  })

  // A stored placeholder is NOT a poster. `not: null` alone let these through,
  // which is how 101 fiches with the grey "Affiche à venir" card ended up in
  // sitemap.xml and in the agent-facing markdown/MCP surfaces.
  it("rejects the house placeholder and the empty string as posters", () => {
    for (const fake of NON_POSTER_URLS) {
      expect(isPublicMedia({ ...ok, posterUrl: fake })).toBe(false)
    }
  })

  it("keeps the where-fragment and the predicate in step", () => {
    // Same rule expressed twice (predicate + Prisma fragment) — the drift
    // between them is exactly the bug this pins.
    expect(publicMediaWhere.posterUrl.notIn).toEqual([...NON_POSTER_URLS])
  })

  it("rejects a missing quality score (defaults to 0)", () => {
    expect(isPublicMedia({ posterUrl: "https://x/p.jpg", type: "MOVIE" })).toBe(false)
  })

  it("always rejects MANGA, even when otherwise public", () => {
    expect(isPublicMedia({ ...ok, type: "MANGA" })).toBe(false)
  })

  it("pins the public quality floor at 30", () => {
    expect(PUBLIC_MEDIA_QUALITY_FLOOR).toBe(30)
  })
})
