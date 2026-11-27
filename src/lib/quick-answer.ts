import { mediaTypeLabels } from "@/lib/utils"
import type { MediaType } from "@/lib/media-route"
import { isKnownAge } from "@/lib/age-label"
import { buildFicheReasons, UNNAMED_SIGNAL_SENTENCE } from "@/lib/fiche-reasons"

export interface QuickAnswerInput {
  title: string
  type: MediaType | string
  expertAgeRec: number | null
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    /** « Ce que les parents doivent savoir » bullets (scary nouns for the reasons). */
    whatParentsNeedToKnow?: string[] | null
    /** « Ce qui peut marquer » flags, read above the card's confidence gate. */
    sensitiveWarnings?: string[] | null
    enrichmentConfidence?: number | null
  }
  /**
   * When true (film/jeu pas encore sorti ou fiche provisoire), we have NOT
   * watched/evaluated the title, so the answer must stay an honest estimate:
   * the age is flagged "à confirmer" and we make zero claims about content
   * (no "aucun signal sensible majeur" — that would imply an analysis exists).
   * See `shouldHideContentAnalysis` in @/lib/release-status.
   */
  hideContentAnalysis?: boolean
  /**
   * Release date (ISO or « YYYY-MM-DD »). Its year follows the title in the
   * answer — « Le Seigneur des anneaux (2001) » — so a franchise or remake
   * search lands on the right work. Absent or unparsable: no year.
   */
  releaseDate?: string | Date | null
}

export interface QuickAnswer {
  question: string
  answer: string
  age: string
  sensitiveText: string
  positiveText: string
}

/**
 * The verdict after « conseillé »: « à partir de 10 ans », or « pour tous
 * publics » for 0 — a real rating (CNC TP), never « âge à confirmer »
 * (see @/lib/age-label).
 */
function ageVerdict(age: number): string {
  return age === 0 ? "pour tous publics" : `à partir de ${age} ans`
}

function releaseYear(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const year = typeof date === "string" ? Number(date.slice(0, 4)) : date.getUTCFullYear()
  return Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null
}

// Shared by the media detail page (FAQPage JSON-LD + hero block) and
// the /md/media/[id] route, so both renders give the same wording.
export function buildQuickAnswer(input: QuickAnswerInput): QuickAnswer {
  const typeLabel = mediaTypeLabels[input.type]?.toLowerCase() || "contenu"
  // The question keeps the bare title (it mirrors the search); the answer
  // names the work with its year.
  const question = `${input.title} : à partir de quel âge ? Est-il adapté aux enfants ?`
  const year = releaseYear(input.releaseDate)
  const media = { ...input, title: year ? `${input.title} (${year})` : input.title }
  const ageRec = media.expertAgeRec

  // Question phrased to match the dominant search intent ("à partir de quel
  // âge") while keeping the natural "adapté aux enfants" follow-up.

  // No evaluation to stand on, so an honest estimate and no content claims:
  // a pre-release / provisional fiche, or no age at all. A title without a
  // verdict was never analysed — the all-zero metrics a missing analysis is
  // mapped to must not read as « aucun signal sensible ».
  if (media.hideContentAnalysis || !isKnownAge(ageRec)) {
    const pending =
      "L'analyse détaillée sera publiée lorsque les informations disponibles permettront de l'établir."
    if (!isKnownAge(ageRec)) {
      return {
        question,
        answer: `${media.title} est un ${typeLabel} dont l'âge conseillé reste à confirmer par Totem Avisé. ${pending}`,
        age: "à un âge encore à confirmer",
        sensitiveText: pending,
        positiveText: "",
      }
    }
    const age = `${ageVerdict(ageRec)} (à confirmer)`
    const lead =
      ageRec === 0
        ? `${media.title} est un ${typeLabel} estimé tous publics (à confirmer) par Totem Avisé.`
        : `${media.title} est un ${typeLabel} dont l'âge est estimé ${age} par Totem Avisé.`
    return { question, answer: `${lead} ${pending}`, age, sensitiveText: pending, positiveText: "" }
  }

  const age = ageVerdict(ageRec)

  // The reasons come from the fiche's own analysis (src/lib/fiche-reasons.ts),
  // the SAME ones the meta description gives, so the SERP, this answer and
  // the page never contradict each other. « Aucun signal sensible majeur »
  // only when nothing at all is flagged — Beetlejuice used to say it next to
  // a list of frightening creatures.
  const { reasons, hasSignal } = buildFicheReasons(media)

  const positivePoints: string[] = []
  if (media.contentMetrics.positiveMessages >= 4) positivePoints.push("messages positifs")
  if (media.contentMetrics.roleModels >= 4) positivePoints.push("modèles positifs")

  const sensitiveText =
    reasons.length > 0
      ? `Points à vérifier : ${reasons.join(", ")}.`
      : hasSignal
        ? UNNAMED_SIGNAL_SENTENCE
        : "Aucun signal sensible majeur ne ressort dans les dimensions principales."
  const positiveText = positivePoints.length > 0
    ? `Points favorables : ${positivePoints.join(", ")}.`
    : "Les apports positifs sont à lire dans l'analyse détaillée."

  // Say WHY the age, not only which axes to check: a parent searching « à
  // partir de quel âge » gets the reason in the answer itself. Only for a
  // minimum age — « tous publics » has no reason, its signals stay « à
  // surveiller ». Built from the stored analysis only, never a new age.
  const head = `${media.title} est un ${typeLabel} conseillé ${age} par Totem Avisé`
  const verdict =
    reasons.length === 0
      ? `${head}. ${sensitiveText}`
      : ageRec > 0
        ? `${head}, principalement en raison de : ${reasons.join(", ")}.`
        : `${head}. À surveiller malgré tout : ${reasons.join(", ")}.`

  return {
    question,
    answer: `${verdict} ${positiveText}`,
    age,
    sensitiveText,
    positiveText,
  }
}
