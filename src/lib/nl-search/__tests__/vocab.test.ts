import { describe, expect, it } from "vitest"
import { platformsFor, topicsFor } from "@/components/home-redesign/catalogue/useCatalogueFilters"
import { FILTERABLE_PLATFORMS } from "@/lib/streaming-providers"
import { GAME_GENRE_TOPICS } from "@/lib/igdb-genres"
import {
  AVOID_RULES,
  MOVIE_TV_THEMES,
  NL_AVOID_KEYS,
  NL_GAME_PLATFORMS,
  NL_GAME_THEMES,
  NL_PLATFORMS,
  NL_THEMES,
  canonicalize,
  resolveAvoidFilters,
} from "../vocab"

/**
 * vocab.ts re-declares the catalogue's movie/TV topic and console lists because
 * their source is a "use client" module that must not enter the server bundle.
 * These tests are what make that duplication safe: they fail the moment the
 * catalogue changes a value without vocab.ts following.
 */
describe("vocabulary drift pins", () => {
  it("mirrors the catalogue's movie/TV topics exactly", () => {
    expect([...MOVIE_TV_THEMES]).toEqual(topicsFor("MOVIE"))
  })

  it("mirrors the catalogue's console list exactly", () => {
    expect(NL_GAME_PLATFORMS).toEqual(platformsFor("GAME"))
  })

  it("offers exactly the filterable streaming platforms", () => {
    expect(NL_PLATFORMS).toEqual([...FILTERABLE_PLATFORMS])
  })

  it("offers exactly the game genre vocabulary", () => {
    expect(NL_GAME_THEMES).toEqual([...GAME_GENRE_TOPICS])
  })

  it("includes catalogue topics plus the quiz interests, without duplicates", () => {
    for (const theme of MOVIE_TV_THEMES) expect(NL_THEMES).toContain(theme)
    expect(NL_THEMES).toContain("Dinosaures") // quiz-only interest
    expect(new Set(NL_THEMES).size).toBe(NL_THEMES.length)
  })
})

describe("canonicalize", () => {
  it("recovers the canonical spelling regardless of case and accents", () => {
    expect(canonicalize("animaux", NL_THEMES)).toBe("Animaux")
    expect(canonicalize("EDUCATIF", NL_THEMES)).toBe("Éducatif")
    expect(canonicalize("  Espace  ", NL_THEMES)).toBe("Espace")
  })

  it("rejects anything outside the vocabulary", () => {
    expect(canonicalize("Horreur", NL_THEMES)).toBeNull()
    expect(canonicalize("Guerre", NL_THEMES)).toBeNull()
    expect(canonicalize("", NL_THEMES)).toBeNull()
  })
})

describe("avoid rules", () => {
  it("defines a rule for every avoid key", () => {
    for (const key of NL_AVOID_KEYS) {
      expect(AVOID_RULES[key]).toBeDefined()
      expect(AVOID_RULES[key].excludeTags.length).toBeGreaterThan(0)
      expect(AVOID_RULES[key].label).toBeTruthy()
    }
  })

  it("unions exclusions and keeps the strictest violence ceiling", () => {
    const resolved = resolveAvoidFilters(["peur", "violence"])
    expect(resolved.excludeTags).toContain("Horreur")
    expect(resolved.excludeTags).toContain("Guerre") // from "violence"
    expect(resolved.excludeTags).toContain("Zombies") // from "peur"
    expect(resolved.maxViolence).toBe(2)
    // De-duplicated across overlapping rules.
    expect(new Set(resolved.excludeTags).size).toBe(resolved.excludeTags.length)
  })

  it("returns no filters for an empty selection", () => {
    expect(resolveAvoidFilters([])).toEqual({ excludeTags: [] })
  })
})
