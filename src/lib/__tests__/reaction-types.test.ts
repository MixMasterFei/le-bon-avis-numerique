import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import {
  VALID_REACTIONS,
  REACTION_FR_LABELS,
  isValidReaction,
  reactionLabelFr,
  seenLabelFr,
} from "@/lib/reaction-types"
import { REACTION_WEIGHTS } from "@/lib/preference-vector"

// ---------------------------------------------------------------------------
// The reaction pipe has ONE vocabulary, declared in four places that cannot
// drift: the Prisma enum (storage), VALID_REACTIONS (API allow-list),
// REACTION_WEIGHTS (vector recompute) and the UI surfaces. These tests fail
// the moment someone adds a reaction type in one place and forgets another —
// which is exactly how "à voir" taps could otherwise vanish from history
// or be ignored by recommendations.
//
// (REACTION_FR_LABELS and MemberCorner's REACTION_STYLE are typed
// Record<ReactionValue, …>, so tsc already proves their coverage at compile
// time — no runtime assertion needed for those.)
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "../../..")

function readSource(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8")
}

describe("reaction vocabulary sync", () => {
  it("matches the Prisma ReactionType enum exactly", () => {
    const schema = readSource("prisma/schema.prisma")
    const match = schema.match(/enum ReactionType \{([^}]+)\}/)
    expect(match).not.toBeNull()
    const enumValues = match![1]
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter(Boolean)
    expect(new Set(enumValues)).toEqual(new Set(VALID_REACTIONS))
  })

  it("gives every reaction a non-zero preference-vector weight", () => {
    for (const value of VALID_REACTIONS) {
      expect(REACTION_WEIGHTS[value], `${value} missing from REACTION_WEIGHTS`).toBeTypeOf("number")
      expect(REACTION_WEIGHTS[value], `${value} has weight 0 — the vector would silently ignore it`).not.toBe(0)
    }
  })

  it("has no orphan weights for reactions the API would reject", () => {
    for (const key of Object.keys(REACTION_WEIGHTS)) {
      expect(isValidReaction(key), `REACTION_WEIGHTS has unknown key ${key}`).toBe(true)
    }
  })

  it("PosterActionBar only writes reactions the API accepts", () => {
    const src = readSource("src/components/media/PosterActionBar.tsx")
    const kinds = [...src.matchAll(/kind: "([A-Z_]+)"/g)].map((m) => m[1])
    expect(kinds.length).toBeGreaterThanOrEqual(4)
    for (const kind of kinds) {
      expect(isValidReaction(kind), `PosterActionBar writes unknown reaction ${kind}`).toBe(true)
    }
  })

  it("FamilyReactions (fiche) only writes reactions the API accepts", () => {
    const src = readSource("src/components/media/FamilyReactions.tsx")
    const values = [...src.matchAll(/value: "([A-Z_]+)"/g)].map((m) => m[1])
    expect(values.length).toBeGreaterThanOrEqual(8)
    for (const value of values) {
      expect(isValidReaction(value), `FamilyReactions writes unknown reaction ${value}`).toBe(true)
    }
  })
})

describe("labels", () => {
  it("every reaction has a non-empty French label", () => {
    for (const value of VALID_REACTIONS) {
      expect(REACTION_FR_LABELS[value].trim().length).toBeGreaterThan(0)
    }
  })

  it("adapts the seen label to the media type", () => {
    expect(seenLabelFr("GAME")).toBe("Déjà joué")
    expect(seenLabelFr("BOOK")).toBe("Déjà lu")
    expect(seenLabelFr("MANGA")).toBe("Déjà lu")
    expect(seenLabelFr("MOVIE")).toBe("Déjà vu")
    expect(seenLabelFr("TV")).toBe("Déjà vu")
    expect(seenLabelFr(undefined)).toBe("Déjà vu")
  })

  it("reactionLabelFr routes WATCHED through the per-type verb", () => {
    expect(reactionLabelFr("WATCHED", "GAME")).toBe("Déjà joué")
    expect(reactionLabelFr("WATCHED")).toBe("Déjà vu")
    expect(reactionLabelFr("LOVED", "GAME")).toBe("Adoré")
    // Unknown values fall through verbatim (defensive display, never crash)
    expect(reactionLabelFr("SOMETHING_NEW")).toBe("SOMETHING_NEW")
  })
})

describe("isValidReaction", () => {
  it("accepts every canonical value and rejects everything else", () => {
    for (const value of VALID_REACTIONS) expect(isValidReaction(value)).toBe(true)
    expect(isValidReaction("LOVE")).toBe(false)
    expect(isValidReaction("loved")).toBe(false)
    expect(isValidReaction("")).toBe(false)
    expect(isValidReaction(null)).toBe(false)
    expect(isValidReaction(undefined)).toBe(false)
    expect(isValidReaction(42)).toBe(false)
    expect(isValidReaction({ reaction: "LOVED" })).toBe(false)
  })
})
