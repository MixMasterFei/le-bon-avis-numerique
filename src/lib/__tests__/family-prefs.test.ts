import { describe, expect, it } from "vitest"
import { resolveEffectivePrefs } from "../family-prefs"

const member = {
  useCustomSettings: false,
  sensitivityViolence: 2,
  sensitivityScary: 2,
  sensitivitySexual: 3,
  sensitivityLanguage: 2,
  sensitivitySubstances: 2,
  preferPositiveMessages: 1,
  preferRoleModels: 1,
  preferEducational: 1,
  avoidTopics: ["drogue"],
}

const familySettings = {
  defaultSensitivityViolence: 3,
  defaultSensitivityScary: 3,
  defaultSensitivitySexual: 3,
  defaultSensitivityLanguage: 3,
  defaultSensitivitySubstances: 3,
  defaultPreferPositiveMessages: 2,
  defaultPreferRoleModels: 2,
  defaultPreferEducational: 2,
  blockedTopics: ["armes"],
}

describe("resolveEffectivePrefs", () => {
  it("inherits family sensitivity defaults when the member hasn't overridden", () => {
    const eff = resolveEffectivePrefs({ ...member, useCustomSettings: false }, familySettings)
    expect(eff.sensitivityViolence).toBe(3)
    expect(eff.preferPositiveMessages).toBe(2)
  })

  it("uses the member's own sensitivities when useCustomSettings is true", () => {
    const eff = resolveEffectivePrefs({ ...member, useCustomSettings: true }, familySettings)
    expect(eff.sensitivityViolence).toBe(2)
    expect(eff.preferPositiveMessages).toBe(1)
  })

  it("falls back to member values when there are no family settings", () => {
    const eff = resolveEffectivePrefs({ ...member, useCustomSettings: false }, null)
    expect(eff.sensitivityViolence).toBe(2)
  })

  it("always merges member avoidTopics with the account's blockedTopics", () => {
    expect(resolveEffectivePrefs(member, familySettings).avoidTopics).toEqual(["drogue", "armes"])
    // and still includes member topics when inheriting is off
    expect(resolveEffectivePrefs({ ...member, useCustomSettings: true }, familySettings).avoidTopics)
      .toEqual(["drogue", "armes"])
    // no family settings → just the member's own
    expect(resolveEffectivePrefs(member, null).avoidTopics).toEqual(["drogue"])
  })
})
