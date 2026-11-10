import type { FamilyMemberSnapshot } from "@/lib/totem/system-prompt"

/**
 * Who a request is for and what kind of title it asks for, read on the
 * server from the parent's own words — so the recommendation tools can
 * ENFORCE it instead of trusting the model's arguments.
 *
 * Baseline (2026-11-08): a game for Hugo (10) AND Léa (6) came back capped at
 * 10 (Minecraft Dungeons II 8+, Galactic Racer 7+); a teen film night opened
 * on Piper, Peppa Pig and Winnie (3+); a FILM asked on a game page returned
 * Peppa Pig (series) and Mario Kart 8 (game). The model passed the oldest
 * child's age, or none, and the « films » rails had no type filter.
 */

export type RequestedType = "MOVIE" | "TV" | "GAME" | "BOOK" | "SCREEN"

export interface AudienceHint {
  /** Household members named (or « toute la famille »), with their ages. */
  members: Array<{ name: string; age: number }>
  /** Every age known for the audience (members + ages the parent typed). */
  ages: number[]
  youngest: number
  oldest: number
}

export interface TurnHints {
  audience: AudienceHint | null
  /**
   * The type of title asked for. Stated in the CURRENT message → the tools
   * enforce it whatever the model passes; carried over from one of the two
   * previous messages (« Un autre ? ») → only a default when the model passes
   * no type, so a conversation that moves on is not pinned to a stale type.
   */
  requestedType: RequestedType | null
  typeStatedNow: boolean
}

/** At this age the audience is grown-up: no window is enforced. */
const ADULT_AGE = 18
/** « Toute la famille » leaves out babies: they are not the audience. */
const MIN_FAMILY_VIEWER_AGE = 3
/** How many previous user messages a requested type carries over. */
const TYPE_CARRY_OVER = 2

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
}

const WHOLE_FAMILY =
  /\b(toute la famille|tous les trois|tous les quatre|toutes les trois|tous ensemble|les enfants|nos enfants|mes enfants|nos trois enfants|en famille|tout le monde|toute la tribu)\b/
const JOINING =
  /\b(avec nous|aussi|egalement|se joint|se joignent|rejoint|rejoignent|regarde avec|regardent avec|joue avec|jouent avec|en plus|vient avec|viennent avec|sera la|seront la|sera avec)\b/
// « dès 12 ans », « à partir de 10 ans » describe a title, not a child.
const RECOMMENDATION_AGE = /\b(des|a partir de|plus de|moins de|interdit aux moins de|au-dela de)\s*$/
// Someone the parent did not name (« ma fille », « mon grand »): the audience
// carried from earlier messages may no longer be the right one. Possessives
// only — « la Petite Sirène » or « le Grand Bleu » are titles, not children.
const PERSON_REFERENCE =
  /\b(mon|ma|notre|nos|mes|son|sa|leur) (fils|fille|filles|garcon|garcons|enfant|ado|ados|grand|grande|petit|petite|aine|ainee|cadet|cadette|benjamin|benjamine|plus jeune|plus grand|plus grande|neveu|niece|filleul|filleule|copain|copine|ami|amie)\b/

/** Ages the parent typed for the audience: « mon fils de 11 ans », « 10, 13 et 15 ans ». */
export function extractAudienceAges(text: string): number[] {
  const t = norm(text)
  const ages: number[] = []
  for (const m of t.matchAll(/((?:\d{1,2}\s*(?:,|et|ou)\s*)*\d{1,2})\s*ans\b/g)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0)
    if (RECOMMENDATION_AGE.test(before)) continue
    for (const n of m[1].split(/\s*(?:,|et|ou)\s*/)) {
      const age = Number(n)
      if (Number.isInteger(age) && age >= 1 && age <= 17) ages.push(age)
    }
  }
  return ages
}

function namedMembers(text: string, family: readonly FamilyMemberSnapshot[]): FamilyMemberSnapshot[] {
  const t = ` ${norm(text).replace(/[^a-z0-9']+/g, " ")} `
  if (WHOLE_FAMILY.test(norm(text))) {
    return family.filter((m) => m.age != null && m.age >= MIN_FAMILY_VIEWER_AGE)
  }
  return family.filter((m) => m.age != null && t.includes(` ${norm(m.name)} `))
}

/** The type of title asked for in one message, null if none or mixed. */
export function extractRequestedType(text: string): RequestedType | null {
  const t = norm(text)
  const found = new Set<RequestedType>()
  if (/\b(films?|long[- ]metrages?|au cine|cinema)\b/.test(t)) found.add("MOVIE")
  if (/\b(series?|episodes?|saisons?)\b/.test(t)) found.add("TV")
  if (/\b(jeux?(-| )video|jeux?|console|switch|playstation|ps5|xbox|nintendo)\b/.test(t)) found.add("GAME")
  if (/\b(livres?|romans?|bd|bandes? dessinees?|a lire)\b/.test(t)) found.add("BOOK")
  if (found.size === 0 && /\bdessins? animes?\b/.test(t)) return "SCREEN"
  if (found.size === 1) return [...found][0]
  return null
}

/**
 * Hints for the current turn. Earlier messages carry over: « Un film pour
 * Hugo ? » then « Finalement Léa regarde avec nous » → Hugo AND Léa; « Un
 * autre ? » keeps the audience, and the type as a default. A child the parent
 * refers to without a name (« et pour ma grande ? ») drops the carried
 * audience: the turn then runs on the model's own arguments, as before.
 */
export function inferTurnHints(opts: {
  userText: string
  priorUserTexts?: readonly string[]
  family?: readonly FamilyMemberSnapshot[]
}): TurnHints {
  const family = opts.family ?? []
  const prior = opts.priorUserTexts ?? []
  let members: Array<{ name: string; age: number }> = []
  let typedAges: number[] = []

  for (const text of [...prior, opts.userText]) {
    const named = namedMembers(text, family).map((m) => ({ name: m.name, age: m.age as number }))
    const ages = extractAudienceAges(text)
    if (named.length > 0 || ages.length > 0) {
      if (JOINING.test(norm(text))) {
        for (const m of named) if (!members.some((x) => x.name === m.name)) members.push(m)
        typedAges = [...typedAges, ...ages]
      } else {
        members = named
        typedAges = ages
      }
    } else if (PERSON_REFERENCE.test(norm(text))) {
      members = []
      typedAges = []
    }
  }

  const statedNow = extractRequestedType(opts.userText)
  let requestedType = statedNow
  if (!requestedType) {
    for (const text of prior.slice(-TYPE_CARRY_OVER).reverse()) {
      requestedType = extractRequestedType(text)
      if (requestedType) break
    }
  }

  const allAges = [...members.map((m) => m.age), ...typedAges]
  return {
    audience:
      allAges.length > 0
        ? { members, ages: allAges, youngest: Math.min(...allAges), oldest: Math.max(...allAges) }
        : null,
    requestedType,
    typeStatedNow: statedNow != null,
  }
}

/**
 * The age window the recommendation tools enforce. The youngest viewer caps
 * the maximum (the model may only go lower); from 9 years up, a floor of
 * youngest − 5 keeps toddler titles out (the site's own « un peu jeune » rule
 * starts at a 6-year gap). A grown-up audience gets no window, and a model
 * that asks for less than the floor (the audience changed without a name)
 * gets its ceiling without the floor.
 */
export function ageWindowFor(
  audience: AudienceHint | null,
  requested: { minAge?: number; maxAge?: number },
): { minAge?: number; maxAge?: number } {
  if (!audience || audience.youngest >= ADULT_AGE) return requested
  const maxAge = requested.maxAge == null ? audience.youngest : Math.min(requested.maxAge, audience.youngest)
  let floor = audience.youngest >= 9 ? audience.youngest - 5 : undefined
  if (floor != null && requested.maxAge != null && requested.maxAge < floor) floor = undefined
  let minAge = floor == null ? requested.minAge : Math.max(requested.minAge ?? 0, floor)
  if (minAge != null && minAge > maxAge) minAge = maxAge
  return { ...(minAge != null ? { minAge } : {}), maxAge }
}

export const REQUESTED_TYPE_LABELS: Record<RequestedType, string> = {
  MOVIE: "film",
  TV: "série",
  GAME: "jeu vidéo",
  BOOK: "livre",
  SCREEN: "film ou série (dessin animé)",
}

/** Dynamic-tail note telling the model what the tools now enforce. */
export function buildHintsNote(hints: TurnHints): string | null {
  const lines: string[] = []
  if (hints.audience && hints.audience.youngest < ADULT_AGE) {
    const who = [
      ...hints.audience.members.map((m) => `${m.name} (${m.age} ans)`),
      ...hints.audience.ages.slice(hints.audience.members.length).map((a) => `un enfant de ${a} ans`),
    ].join(", ")
    const w = ageWindowFor(hints.audience, {})
    lines.push(
      `- Public de cette demande (déduit des messages) : ${who}. Le plus jeune a ${hints.audience.youngest} ans : rien au-dessus de ${w.maxAge} ans${w.minAge != null ? `, et rien de « tout-petit » (sous ${w.minAge} ans)` : ""}. Les outils de recommandation appliquent déjà ces bornes.`,
    )
  }
  if (hints.requestedType && hints.typeStatedNow) {
    lines.push(
      `- Type demandé : ${REQUESTED_TYPE_LABELS[hints.requestedType]}. Les outils de recommandation ne renvoient que ce type ; ne propose rien d'autre (même sur la fiche d'un autre type).`,
    )
  } else if (hints.requestedType) {
    lines.push(
      `- Type demandé juste avant : ${REQUESTED_TYPE_LABELS[hints.requestedType]}. Garde-le pour « un autre », sauf si le parent passe à autre chose.`,
    )
  }
  return lines.length ? `# Demande en cours\n${lines.join("\n")}` : null
}
