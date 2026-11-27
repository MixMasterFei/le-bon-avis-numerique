/**
 * The 2–3 main content reasons of a fiche, in a few words, built ONLY from the
 * fiche's own analysis — the scores shown as bars (« Violence 2/5 »), the
 * « Ce qui peut marquer » flags and the « Ce que les parents doivent savoir »
 * bullets. Nothing here is invented, and nothing here produces an age.
 *
 * Single source for three surfaces that used to disagree:
 *   - the meta description (`buildFicheDescription`, src/lib/fiche-title.ts);
 *   - the visible quick answer + FAQ JSON-LD (`buildQuickAnswer`);
 *   - the « Pourquoi cet âge ? » note when no axis stands out (`buildAgeRationale`).
 * Beetlejuice (1988) said « Aucun signal sensible majeur » in its FAQ while
 * the page listed frightening creatures: the FAQ only looked at scores ≥ 3,
 * the page shows everything.
 *
 * Rules:
 *   - A score counts from `REASON_METRIC_MIN` (2/5): the level the bars make
 *     visibly non-trivial. « violence 2/5 » is what the page shows, in words.
 *   - « Ce qui peut marquer » flags count only above the same confidence gate
 *     as the card (`WARNINGS_MIN_CONFIDENCE`). Only GENERIC flags are named
 *     (frightening scenes, disturbing images, tension…): the card is folded by
 *     default because the specific ones spoil the story (« Noyade »,
 *     « Accident de voiture », a death). Those still count as a signal — the
 *     answer then says points are detailed on the fiche, never « aucun signal ».
 *   - The frightening-scenes flag borrows its nouns (fantômes, créatures…)
 *     from the parents' bullets when one names them, so the reason reads
 *     « fantômes et créatures qui peuvent effrayer » rather than a category.
 *     A bullet with a negation (« pas de monstres ») is never read.
 */
import { WARNINGS_MIN_CONFIDENCE } from "@/lib/sensitive-warnings"

/** A score at or above this level is a reason (and a signal). */
export const REASON_METRIC_MIN = 2
/** A score at or above this level leads the reasons. */
const STRONG_METRIC_MIN = 3
export const MAX_REASONS = 3

export interface FicheReasonsInput {
  type?: string | null
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    whatParentsNeedToKnow?: string[] | null
    sensitiveWarnings?: string[] | null
    enrichmentConfidence?: number | null
  }
}

export interface FicheReasons {
  /** Up to MAX_REASONS short lower-case phrases, most marked first. */
  reasons: string[]
  /**
   * Something sensitive is on the page: a score ≥ REASON_METRIC_MIN or a
   * displayed flag (spoiler flags included). False is the ONLY case where
   * « Aucun signal sensible majeur » may be said.
   */
  hasSignal: boolean
  /** Only spoiler-type flags (unnamed here) carry the signal. */
  onlyUnnamedSignal: boolean
}

type MetricKey = "violence" | "sexNudity" | "language" | "substanceUse" | "consumerism"

/** Severity order for ties; labels are the ones on the fiche's score rows. */
const METRIC_ORDER: MetricKey[] = ["violence", "sexNudity", "language", "substanceUse", "consumerism"]
const METRIC_LABELS: Record<MetricKey, string> = {
  violence: "violence",
  sexNudity: "sexe/nudité",
  language: "langage",
  substanceUse: "substances",
  consumerism: "consumérisme",
}
/** GameMetricsDisplay names two rows differently. */
const GAME_METRIC_LABELS: Partial<Record<MetricKey, string>> = {
  sexNudity: "sexualité",
  consumerism: "achats intégrés",
}

const SCARY = "Scènes effrayantes ou angoissantes"

/** Generic flags, named in this order. Each is a category, never a scene. */
const NAMED_FLAGS: [flag: string, phrase: string][] = [
  [SCARY, "scènes qui peuvent effrayer"],
  ["Images dérangeantes", "images dérangeantes"],
  ["Suspense ou tension intense", "tension intense"],
  ["Sang ou blessures", "sang ou blessures"],
  ["Thèmes matures ou complexes", "thèmes matures ou complexes"],
  ["Comportements à risque imités", "comportements à risque"],
  ["Guerre", "contexte de guerre"],
  ["Stéréotypes datés", "stéréotypes datés"],
  ["Humour à connotation ethnique ou religieuse", "humour à connotation ethnique ou religieuse"],
]

/** Flags that restate a score axis: named only when that axis is not already a reason. */
const AXIS_FLAGS: [flag: string, axis: MetricKey, phrase: string][] = [
  ["Violence intense ou graphique", "violence", "violence intense"],
  ["Violence", "violence", "violence"],
  ["Langage grossier", "language", "langage grossier"],
  ["Références ou contenu sexuel", "sexNudity", "références sexuelles"],
  ["Nudité", "sexNudity", "nudité"],
  ["Consommation d'alcool ou de tabac", "substanceUse", "alcool ou tabac"],
  ["Consommation de drogues", "substanceUse", "drogues"],
]

/** Nouns a parents' bullet may give to the frightening-scenes reason. */
const SCARY_NOUNS = [
  "fantôme", "créature", "monstre", "zombie", "sorcière", "démon", "vampire", "squelette", "clown",
]
const NEGATION = /\b(?:pas|aucun|aucune|sans|ni|peu|jamais)\b/i
const SCARY_WORDS = /effray|terrifi|angoiss|cauchemar|épouvant/i

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** « fantômes et créatures » from the bullets, as written (singular or plural). */
function scaryNouns(bullets: string[]): string[] {
  const found: { word: string; plural: boolean }[] = []
  for (const bullet of bullets) {
    if (NEGATION.test(bullet)) continue
    for (const noun of SCARY_NOUNS) {
      if (found.some((f) => f.word === noun)) continue
      const m = bullet.match(new RegExp(`(?:^|[^\\p{L}])(${escapeRe(noun)})(s?)(?![\\p{L}])`, "iu"))
      if (m) found.push({ word: noun, plural: m[2] === "s" })
    }
  }
  return found.slice(0, 2).map((f) => (f.plural ? `${f.word}s` : f.word))
}

function scaryPhrase(bullets: string[]): string {
  const nouns = scaryNouns(bullets)
  if (nouns.length === 0) return "scènes qui peuvent effrayer"
  const verb = nouns.length === 1 && !nouns[0].endsWith("s") ? "peut" : "peuvent"
  return `${nouns.join(" et ")} qui ${verb} effrayer`
}

export function buildFicheReasons(input: FicheReasonsInput): FicheReasons {
  const m = input.contentMetrics
  const isGame = input.type === "GAME"
  const label = (k: MetricKey) => (isGame && GAME_METRIC_LABELS[k]) || METRIC_LABELS[k]

  const scored = METRIC_ORDER.map((k) => ({ k, v: Number(m[k]) || 0 }))
    .filter((x) => x.v >= REASON_METRIC_MIN)
    .sort((a, b) => b.v - a.v) // stable: ties keep METRIC_ORDER
  const strong = scored.filter((x) => x.v >= STRONG_METRIC_MIN)
  const mild = scored.filter((x) => x.v < STRONG_METRIC_MIN)
  const axesCovered = new Set(scored.map((x) => x.k))

  const bullets = (m.whatParentsNeedToKnow ?? []).filter((b) => typeof b === "string" && b.trim())
  const confident = (m.enrichmentConfidence ?? 0) >= WARNINGS_MIN_CONFIDENCE
  const flags = new Set(confident ? (m.sensitiveWarnings ?? []) : [])
  // The bullets are always on the page: a non-negated « effrayant » there is
  // the same signal as the flag, even when the flags sit under the gate.
  const scaryFromBullets = bullets.some((b) => !NEGATION.test(b) && SCARY_WORDS.test(b))

  const named: string[] = []
  for (const [flag, phrase] of NAMED_FLAGS) {
    if (flag === SCARY) {
      if (flags.has(SCARY) || scaryFromBullets) named.push(scaryPhrase(bullets))
    } else if (flags.has(flag)) {
      named.push(phrase)
    }
  }
  const axisNamed = new Set<MetricKey>()
  for (const [flag, axis, phrase] of AXIS_FLAGS) {
    if (!flags.has(flag) || axesCovered.has(axis) || axisNamed.has(axis)) continue
    axisNamed.add(axis)
    named.push(phrase)
  }
  const knownFlags = new Set<string>([...NAMED_FLAGS.map(([f]) => f), ...AXIS_FLAGS.map(([f]) => f)])
  const unnamedFlag = [...flags].some((f) => !knownFlags.has(f))

  // Scores lead when marked; one flag phrase when the scores already give two
  // reasons, so a mild score is not crowded out by a list of categories.
  const metricCount = scored.length
  const flagCap = metricCount >= 2 ? 1 : metricCount === 1 ? 2 : MAX_REASONS
  const reasons = [
    ...strong.map((x) => `${label(x.k)} ${x.v}/5`),
    ...named.slice(0, flagCap),
    ...mild.map((x) => `${label(x.k)} ${x.v}/5`),
  ].slice(0, MAX_REASONS)

  const hasSignal = reasons.length > 0 || unnamedFlag
  return { reasons, hasSignal, onlyUnnamedSignal: reasons.length === 0 && unnamedFlag }
}

/** « a, b et c ». */
export function joinReasonsFr(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`
}

/** Upper-cases the first letter (sentence start). */
export function capitalizeFr(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

/** Said when only spoiler-type flags carry the signal (named on the fiche, folded). */
export const UNNAMED_SIGNAL_SENTENCE = "Quelques points de vigilance sont détaillés dans la fiche."
