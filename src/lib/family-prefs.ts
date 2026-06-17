import type { FamilySettings } from "@prisma/client"

/**
 * Resolve a family member's *effective* preferences for scoring.
 *
 * Sensitivities + positive-content prefs are the member's own when
 * `useCustomSettings` is true (or there are no family settings), otherwise they
 * inherit the account-wide `FamilySettings` defaults. `avoidTopics` is always
 * the member's list merged with the account's `blockedTopics`.
 *
 * Genres / disliked genres / interests are NOT inherited (always the member's
 * own) and are left to the caller.
 *
 * This is the single source of truth for the inheritance rule — previously
 * inlined in `smart-filter.ts` and missing entirely from the family-fit routes,
 * which scored members on their raw (often default) sensitivities.
 */
export interface MemberPrefsInput {
  useCustomSettings: boolean
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  avoidTopics: string[]
}

export interface EffectivePrefs {
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  avoidTopics: string[]
}

type FamilyDefaults = Pick<
  FamilySettings,
  | "defaultSensitivityViolence"
  | "defaultSensitivityScary"
  | "defaultSensitivitySexual"
  | "defaultSensitivityLanguage"
  | "defaultSensitivitySubstances"
  | "defaultPreferPositiveMessages"
  | "defaultPreferRoleModels"
  | "defaultPreferEducational"
  | "blockedTopics"
>

export function resolveEffectivePrefs(
  member: MemberPrefsInput,
  familySettings: FamilyDefaults | null,
): EffectivePrefs {
  const avoidTopics = [...member.avoidTopics, ...(familySettings?.blockedTopics ?? [])]

  if (member.useCustomSettings || !familySettings) {
    return {
      sensitivityViolence: member.sensitivityViolence,
      sensitivityScary: member.sensitivityScary,
      sensitivitySexual: member.sensitivitySexual,
      sensitivityLanguage: member.sensitivityLanguage,
      sensitivitySubstances: member.sensitivitySubstances,
      preferPositiveMessages: member.preferPositiveMessages,
      preferRoleModels: member.preferRoleModels,
      preferEducational: member.preferEducational,
      avoidTopics,
    }
  }

  return {
    sensitivityViolence: familySettings.defaultSensitivityViolence,
    sensitivityScary: familySettings.defaultSensitivityScary,
    sensitivitySexual: familySettings.defaultSensitivitySexual,
    sensitivityLanguage: familySettings.defaultSensitivityLanguage,
    sensitivitySubstances: familySettings.defaultSensitivitySubstances,
    preferPositiveMessages: familySettings.defaultPreferPositiveMessages,
    preferRoleModels: familySettings.defaultPreferRoleModels,
    preferEducational: familySettings.defaultPreferEducational,
    avoidTopics,
  }
}
