import { getDaySeed } from "@/lib/seeded-shuffle"

/**
 * "Le totem a parlé" — the Coin Famille hero's one-liner, written as if Totem
 * itself explains WHY today's pick fits. Owner brief: a specific, lightly funny
 * tone (à la mascot persona) that catches attention — but hand-crafted
 * templates only, never AI-generated jokes at runtime (they misfire).
 *
 * Deterministic: the template rotates with the day + the title, so the line
 * changes daily without flickering between renders. Templates are deadpan-warm
 * and safe — they poke fun at the totem, never at the child or the family.
 */

const FAMILY_LINES_WITH_GENRE = [
  "Vérifié trois fois : du {genre} qui plaît à tout le foyer. Le totem n'en revient toujours pas.",
  "{genre} pour les uns, {genre2} pour les autres : ce titre coche les deux cases. Le totem approuve.",
  "Le totem a comparé les goûts de tout le monde — ce {genre} est ressorti en tête, sans tricher.",
] as const

const FAMILY_LINES_PLAIN = [
  "Un choix validé pour chaque membre du foyer — autant dire un petit miracle statistique.",
  "De quoi mettre tout le monde d'accord avant même la fin du générique d'ouverture.",
  "Le genre de titre qui évite le débat du soir. Le totem aime les soirées calmes.",
  "Le totem a pesé les goûts de chacun. Celui-ci est ressorti en tête, à l'unanimité ou presque.",
] as const

const MEMBER_LINES_WITH_GENRE = [
  "Du {genre}, le rayon préféré de {name} — le totem n'a pas eu à chercher bien loin.",
  "Le radar du totem a clignoté pour {name} dès la première seconde. {genre} oblige.",
  "Si {name} aime le {genre}, ceci devrait faire mouche. Le totem est plutôt sûr de son coup.",
] as const

const MEMBER_LINES_PLAIN = [
  "Choisi pour {name} : bon âge, bons goûts, zéro mauvaise surprise. Le totem a fait le tri.",
  "Repéré pour {name} : dans ses goûts, à son âge, prêt à lancer. Le totem retourne veiller.",
  "{name} d'abord : ce choix suit ses goûts à lui, pas ceux de l'algorithme du voisin.",
] as const

/** Small stable hash so the line varies per title, not just per day. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length]
}

export interface TotemVoiceInput {
  /** Family-member first name; omit for the whole-family tab. */
  memberName?: string | null
  title: string
  /** Already-translated FR genre labels (e.g. via genreLabelFr). */
  genres?: string[]
  /** Injectable for tests; defaults to today's Paris day seed. */
  daySeed?: number
}

/** One French sentence in Totem's voice explaining why the pick fits. */
export function totemVoiceLine({ memberName, title, genres = [], daySeed }: TotemVoiceInput): string {
  const seed = (daySeed ?? getDaySeed()) + hashString(title)
  const genre = genres[0]?.toLowerCase()
  const genre2 = genres[1]?.toLowerCase()

  if (memberName) {
    if (genre) {
      return pick(MEMBER_LINES_WITH_GENRE, seed)
        .replaceAll("{name}", memberName)
        .replaceAll("{genre}", genre)
    }
    return pick(MEMBER_LINES_PLAIN, seed).replaceAll("{name}", memberName)
  }

  if (genre && genre2) {
    return pick(FAMILY_LINES_WITH_GENRE, seed)
      .replaceAll("{genre}", genre)
      .replaceAll("{genre2}", genre2)
  }
  if (genre) {
    // Templates needing {genre2} are excluded when only one genre exists.
    const singleGenre = FAMILY_LINES_WITH_GENRE.filter((t) => !t.includes("{genre2}"))
    return pick(singleGenre, seed).replaceAll("{genre}", genre)
  }
  return pick(FAMILY_LINES_PLAIN, seed)
}
