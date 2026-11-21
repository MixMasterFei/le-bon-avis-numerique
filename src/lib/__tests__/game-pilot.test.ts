import { describe, expect, it } from "vitest"
import { GAME_PILOT_CONTROL_IDS, GAME_PILOT_TREATED_IDS, isGamePilot, isGamePilotControl } from "@/lib/game-pilot"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("game pilot lists", () => {
  it("holds 100 treated and 100 control fiches, unique and disjoint", () => {
    expect(GAME_PILOT_TREATED_IDS).toHaveLength(100)
    expect(GAME_PILOT_CONTROL_IDS).toHaveLength(100)
    expect(new Set(GAME_PILOT_TREATED_IDS).size).toBe(100)
    expect(new Set(GAME_PILOT_CONTROL_IDS).size).toBe(100)
    const treated = new Set(GAME_PILOT_TREATED_IDS)
    expect(GAME_PILOT_CONTROL_IDS.filter((id) => treated.has(id))).toEqual([])
  })

  it("stores media ids (UUIDs)", () => {
    for (const id of [...GAME_PILOT_TREATED_IDS, ...GAME_PILOT_CONTROL_IDS]) expect(id).toMatch(UUID)
  })

  it("treats only the treated fiches; controls stay unchanged", () => {
    const t = GAME_PILOT_TREATED_IDS[0]
    const c = GAME_PILOT_CONTROL_IDS[0]
    expect(isGamePilot(t)).toBe(true)
    expect(isGamePilotControl(t)).toBe(false)
    expect(isGamePilot(c)).toBe(false)
    expect(isGamePilotControl(c)).toBe(true)
    expect(isGamePilot(null)).toBe(false)
    expect(isGamePilot(undefined)).toBe(false)
    expect(isGamePilot("not-an-id")).toBe(false)
  })
})
