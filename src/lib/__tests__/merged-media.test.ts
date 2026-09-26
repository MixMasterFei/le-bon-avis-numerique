import { describe, expect, it } from "vitest"
import { MERGED_MEDIA_IDS, resolveMergedMediaPath } from "@/lib/merged-media"

const OLD = "068c5396-4416-4f33-9bd7-3ac5e826c0d9"
const SURVIVOR = "/media/game:ced84a43-f4b1-4d7a-ae0c-489aee0a11e1"

describe("resolveMergedMediaPath", () => {
  it("sends the deleted GTA V duplicate to the surviving fiche, whatever the URL form", () => {
    expect(resolveMergedMediaPath(`/media/game:${OLD}`)).toBe(SURVIVOR)
    expect(resolveMergedMediaPath(`/media/game%3A${OLD}`)).toBe(SURVIVOR)
    expect(resolveMergedMediaPath(`/media/${OLD}`)).toBe(SURVIVOR)
    expect(resolveMergedMediaPath(`/media/GAME:${OLD.toUpperCase()}/`)).toBe(SURVIVOR)
  })

  it("leaves every other path alone", () => {
    expect(resolveMergedMediaPath("/media/game:ced84a43-f4b1-4d7a-ae0c-489aee0a11e1")).toBeNull()
    expect(resolveMergedMediaPath("/media/game:not-a-uuid")).toBeNull()
    expect(resolveMergedMediaPath(`/films/${OLD}`)).toBeNull()
    expect(resolveMergedMediaPath(`/media/game:${OLD}/avis`)).toBeNull()
    expect(resolveMergedMediaPath("/")).toBeNull()
  })

  it("only ever points at a typed route id, never back at a merged id", () => {
    for (const [from, to] of Object.entries(MERGED_MEDIA_IDS)) {
      expect(to).toMatch(/^(movie|tv|game|book|app|manga):[0-9a-f-]{36}$/)
      expect(MERGED_MEDIA_IDS[to.split(":")[1]]).toBeUndefined()
      expect(from).not.toBe(to.split(":")[1])
    }
  })
})
