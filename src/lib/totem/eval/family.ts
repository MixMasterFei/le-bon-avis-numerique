import { prisma } from "@/lib/prisma"
import {
  ageVerdictFromAges,
  AGE_PILLAR_LABELS,
  legacyLevelFromPillars,
  PREFERENCE_PILLAR_LABELS,
  type PreferencePillar,
} from "@/lib/family-fit-display"
import { toFamilySnapshot, type FamilyMemberRow } from "@/lib/totem/pipeline"
import type { FamilyMemberSnapshot } from "@/lib/totem/system-prompt"
import type { TotemFamilyDataAccess } from "@/lib/totem/tools"

/**
 * The evaluation bench's household. FICTIONAL — never a real account: it
 * reaches the bot through the same family-context shape as a signed-in
 * family (the prompt's family block and the three household tools), but its
 * data lives here, in memory.
 */

/** Never a real user id (real ids are UUIDs); never written anywhere. */
export const EVAL_USER_ID = "eval-bench-household"

export interface EvalMember {
  id: string
  name: string
  age: number
  avatarEmoji: string
  sensitivities: { violence: number; scary: number; sexual: number; language: number; substances: number }
  favoriteGenres: string[]
  dislikedGenres: string[]
  avoidTopics: string[]
  interests: string[]
}

// Sensitivities: 0 = indifférent … 3 = strict (FamilyMember semantics).
export const EVAL_FAMILY: readonly EvalMember[] = [
  {
    id: "eval-member-lea",
    name: "Léa",
    age: 6,
    avatarEmoji: "🦊",
    sensitivities: { violence: 3, scary: 3, sexual: 3, language: 2, substances: 3 },
    favoriteGenres: ["Animation", "Familial", "Aventure"],
    dislikedGenres: ["Horreur"],
    avoidTopics: ["mort d'un parent"],
    interests: ["animaux", "dessin", "princesses"],
  },
  {
    id: "eval-member-hugo",
    name: "Hugo",
    age: 10,
    avatarEmoji: "🚀",
    sensitivities: { violence: 2, scary: 2, sexual: 3, language: 1, substances: 2 },
    favoriteGenres: ["Aventure", "Science-Fiction", "Comédie"],
    dislikedGenres: ["Romance"],
    avoidTopics: [],
    interests: ["football", "espace", "Minecraft"],
  },
  {
    id: "eval-member-ines",
    name: "Inès",
    age: 14,
    avatarEmoji: "🎧",
    sensitivities: { violence: 1, scary: 1, sexual: 2, language: 1, substances: 2 },
    favoriteGenres: ["Comédie", "Drame", "Fantastique"],
    dislikedGenres: [],
    avoidTopics: ["harcèlement"],
    interests: ["musique", "manga", "danse"],
  },
]

export function findEvalMember(name: string): EvalMember | undefined {
  return EVAL_FAMILY.find((m) => m.name === name)
}

/**
 * FamilyMember-shaped rows for the shared snapshot builder. Birth year is
 * derived from the run date (birth month January) so getMemberAge returns the
 * fixture age exactly, whatever the year.
 */
export function evalFamilyRows(now: Date = new Date()): FamilyMemberRow[] {
  return EVAL_FAMILY.map((m) => ({
    name: m.name,
    birthYear: now.getFullYear() - m.age,
    birthMonth: 1,
    sensitivityViolence: m.sensitivities.violence,
    sensitivityScary: m.sensitivities.scary,
    sensitivitySexual: m.sensitivities.sexual,
    sensitivityLanguage: m.sensitivities.language,
    sensitivitySubstances: m.sensitivities.substances,
    favoriteGenres: m.favoriteGenres,
    avoidTopics: m.avoidTopics,
  }))
}

export function evalFamilySnapshot(now?: Date): FamilyMemberSnapshot[] {
  return toFamilySnapshot(evalFamilyRows(now))
}

/** A reaction the household holds: what it has seen, loved… */
export interface EvalReaction {
  memberId: string
  mediaId: string
  mediaTitle: string
  mediaType: string
  reaction: string
}

export interface EvalHousehold {
  members: readonly EvalMember[]
  reactions: EvalReaction[]
}

const SEEN = new Set(["WATCHED", "LOVED", "LIKED", "OK", "SCARED", "BORED"])

const LEVEL_SCORE: Record<string, number> = { excellent: 85, good: 72, moderate: 50, poor: 20 }

function overlap(a: readonly string[], b: readonly string[]): number {
  const set = new Set(a.map((s) => s.toLowerCase()))
  return b.filter((s) => set.has(s.toLowerCase())).length
}

/**
 * Test double for the household tools. The live getFamilyFit calls the
 * family-fit API with the user's cookie, which needs a real account; here the
 * verdict is built from the site's own two-axis rules (family-fit-display):
 * the AGE pillar from the title's age read live from the catalogue, the
 * PREFERENCE pillar from the fixture's genres and topics to avoid. Same
 * output shape as the live tool.
 */
export function createEvalFamilyData(household: EvalHousehold): TotemFamilyDataAccess {
  return {
    async getSeenMediaIds() {
      return new Set(household.reactions.filter((r) => SEEN.has(r.reaction)).map((r) => r.mediaId))
    },

    async getUserFamilyContext() {
      return {
        status: "ok",
        members: household.members.map((m) => ({
          id: m.id,
          name: m.name,
          age: m.age,
          avatarEmoji: m.avatarEmoji,
          favoriteGenres: m.favoriteGenres.slice(0, 5),
          dislikedGenres: m.dislikedGenres.slice(0, 3),
          avoidTopics: m.avoidTopics.slice(0, 3),
          interests: m.interests.slice(0, 5),
          sensitivities: m.sensitivities,
          useCustomSettings: true,
          recentReactions: household.reactions
            .filter((r) => r.memberId === m.id)
            .slice(-5)
            .map((r) => ({ mediaTitle: r.mediaTitle, mediaType: r.mediaType, reaction: r.reaction })),
        })),
      }
    },

    async getFamilyFit(mediaId: string) {
      const media = await prisma.mediaItem.findUnique({
        where: { id: mediaId },
        select: { expertAgeRec: true, genres: true, topics: true },
      })
      if (!media) return { status: "error", code: 404 }
      return {
        status: "ok",
        members: household.members.map((m) => {
          const age = ageVerdictFromAges(m.age, media.expertAgeRec)
          let pref: PreferencePillar = "check"
          if (overlap(m.dislikedGenres, media.genres) > 0 || overlap(m.avoidTopics, media.topics ?? []) > 0) {
            pref = "avoid"
          } else if (overlap(m.favoriteGenres, media.genres) >= 2) {
            pref = "love"
          } else if (overlap(m.favoriteGenres, media.genres) === 1) {
            pref = "good"
          }
          const level = legacyLevelFromPillars(age.pillar, pref)
          return {
            name: m.name,
            age: m.age,
            score: LEVEL_SCORE[level] ?? 50,
            level,
            reason: `${AGE_PILLAR_LABELS[age.pillar]}${age.detail ? ` (${age.detail})` : ""} · ${PREFERENCE_PILLAR_LABELS[pref]}`,
            hasPreferences: true,
            affinityReason: null,
          }
        }),
      }
    },
  }
}
