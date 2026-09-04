import type { MediaType } from "@/lib/media-route"
import { isAnimationStyle } from "@/lib/age-floor"

/**
 * Builds the public "Pourquoi cet âge ?" rationale shown on a fiche.
 *
 * Goal (moat-safe transparency): explain the age recommendation in plain
 * language so parents trust it and LLMs/Google can cite the reasoning — WITHOUT
 * exposing the calibration that is the actual moat.
 *
 * What we expose:  the verdict, and the content dimensions that drive it,
 *                  described qualitatively (the same 0–5 levels already shown
 *                  on-screen as bars, just put into words).
 * What we hide:    the numeric thresholds, the per-axis cutoffs, the weights,
 *                  the animation/theme discounts — i.e. the recipe. We describe
 *                  WHAT weighs in, never the exact rule that turns a level into
 *                  an age.
 *
 * This is a pure module (no React / no DB) so it can feed both the on-page
 * panel and the structured-data (FAQ) builder from a single source of truth.
 */

export interface AgeRationaleInput {
  title: string
  type: MediaType | string
  expertAgeRec: number | null
  officialRating?: string | null
  genres?: string[]
  topics?: string[]
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
  }
  /**
   * Pre-release / provisional fiche: we have NOT evaluated the content yet, so
   * the rationale must make zero content claims (mirrors quick-answer.ts).
   */
  hideContentAnalysis?: boolean
}

export interface AgeRationaleDriver {
  key: string
  label: string
  /** Qualitative level word — never the raw 0–5 number. */
  level: "Présent" | "Marqué" | "Intense"
}

export interface AgeRationale {
  /** False when there is no age to explain → caller renders nothing. */
  show: boolean
  isProvisional: boolean
  ageLabel: string
  heading: string
  lead: string
  drivers: AgeRationaleDriver[]
  /** Shown when no vigilance axis stands out. */
  noDriverNote?: string
  positives: string[]
  contextNotes: string[]
  trustLine: string
  /** Flat paragraph for structured data (FAQ answer). */
  plainText: string
  /** FAQ question for JSON-LD, or null when there's no age to explain. */
  faqQuestion: string | null
}

const VIGILANCE_LABELS: Record<string, string> = {
  violence: "Violence",
  sexNudity: "Sexe/Nudité",
  language: "Langage",
  substanceUse: "Substances",
  consumerism: "Consumérisme",
}

const WAR_TOPICS = new Set(["guerre", "seconde guerre mondiale", "résistance"])

function levelWord(v: number): AgeRationaleDriver["level"] {
  if (v >= 5) return "Intense"
  if (v >= 4) return "Marqué"
  return "Présent" // v === 3 (driver threshold)
}

const TRUST_LINE =
  "Recommandation indépendante de Totem Avisé, issue d'une analyse automatisée selon des critères publiés. Des garde-fous limitent les incohérences ; les retours des familles permettent de corriger les estimations. Ce repère peut comporter des erreurs et ne remplace pas la classification applicable ni votre connaissance de votre enfant."

export function buildAgeRationale(input: AgeRationaleInput): AgeRationale {
  const hasAge = typeof input.expertAgeRec === "number" && input.expertAgeRec > 0
  const ageLabel = hasAge ? `dès ${input.expertAgeRec} ans` : "à un âge à confirmer"

  // No age at all → nothing to explain.
  if (!hasAge) {
    return {
      show: false,
      isProvisional: !!input.hideContentAnalysis,
      ageLabel,
      heading: "Pourquoi cet âge ?",
      lead: "",
      drivers: [],
      positives: [],
      contextNotes: [],
      trustLine: TRUST_LINE,
      plainText: "",
      faqQuestion: null,
    }
  }

  // Provisional / pre-release: honest estimate, zero content claims.
  if (input.hideContentAnalysis) {
    const lead = `L'âge indiqué (${ageLabel}, à confirmer) est une première estimation, basée sur le synopsis, les classifications disponibles et les genres. L'analyse détaillée sera publiée lorsque les informations disponibles permettront de l'établir.`
    return {
      show: true,
      isProvisional: true,
      ageLabel,
      heading: "Pourquoi cette estimation ?",
      lead,
      drivers: [],
      positives: [],
      contextNotes: [],
      trustLine: TRUST_LINE,
      plainText: `${lead} ${TRUST_LINE}`,
      faqQuestion: `${input.title} : pourquoi est-ce estimé ${ageLabel} ?`,
    }
  }

  const m = input.contentMetrics

  // Drivers = vigilance axes that visibly stand out (level ≥ 3), sorted by
  // severity. We describe the level already shown as a bar, in words.
  const drivers: AgeRationaleDriver[] = (
    [
      ["violence", m.violence],
      ["sexNudity", m.sexNudity],
      ["language", m.language],
      ["substanceUse", m.substanceUse],
      ["consumerism", m.consumerism],
    ] as const
  )
    .filter(([, v]) => v >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([key, v]) => ({ key, label: VIGILANCE_LABELS[key], level: levelWord(v) }))

  const positives: string[] = []
  if (m.positiveMessages >= 4) positives.push("messages positifs")
  if (m.roleModels >= 4) positives.push("modèles positifs")

  // Context notes describe content-derived context (honest, already implied by
  // the detected themes) — NOT the scoring mechanics.
  const contextNotes: string[] = []
  const topics = (input.topics ?? []).map((t) => t.toLowerCase().trim())
  if (topics.some((t) => WAR_TOPICS.has(t)) && !isAnimationStyle(null, input.genres)) {
    contextNotes.push(
      "Le contexte historique ou de guerre du récit est pris en compte dans la recommandation.",
    )
  }

  const heading = `Pourquoi ${ageLabel} ?`

  let lead: string
  let noDriverNote: string | undefined
  if (drivers.length > 0) {
    const driverPhrase = drivers
      .map((d) => `${d.label.toLowerCase()} (${d.level.toLowerCase()})`)
      .join(", ")
    lead = `${input.title} est conseillé ${ageLabel}, principalement en raison de : ${driverPhrase}.`
  } else {
    lead = `${input.title} est conseillé ${ageLabel}.`
    noDriverNote =
      "Aucun élément sensible ne ressort nettement : la recommandation reflète surtout le public visé et les thèmes abordés."
  }

  const positivesSentence =
    positives.length > 0 ? `Points d'appui : ${positives.join(", ")}.` : ""

  const plainText = [
    lead,
    noDriverNote,
    positivesSentence,
    ...contextNotes,
    TRUST_LINE,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    show: true,
    isProvisional: false,
    ageLabel,
    heading,
    lead,
    drivers,
    noDriverNote,
    positives,
    contextNotes,
    trustLine: TRUST_LINE,
    plainText,
    faqQuestion: `${input.title} : pourquoi est-ce conseillé ${ageLabel} ?`,
  }
}
