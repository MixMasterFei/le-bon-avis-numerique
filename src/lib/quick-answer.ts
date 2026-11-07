import { mediaTypeLabels } from "@/lib/utils"
import type { MediaType } from "@/lib/media-route"
import { isKnownAge } from "@/lib/age-label"

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
  }
  /**
   * When true (film/jeu pas encore sorti ou fiche provisoire), we have NOT
   * watched/evaluated the title, so the answer must stay an honest estimate:
   * the age is flagged "à confirmer" and we make zero claims about content
   * (no "aucun signal sensible majeur" — that would imply an analysis exists).
   * See `shouldHideContentAnalysis` in @/lib/release-status.
   */
  hideContentAnalysis?: boolean
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

// Shared by the media detail page (FAQPage JSON-LD + hero block) and
// the /md/media/[id] route, so both renders give the same wording.
export function buildQuickAnswer(media: QuickAnswerInput): QuickAnswer {
  const typeLabel = mediaTypeLabels[media.type]?.toLowerCase() || "contenu"
  const ageRec = media.expertAgeRec

  // Question phrased to match the dominant search intent ("à partir de quel
  // âge") while keeping the natural "adapté aux enfants" follow-up.
  const question = `${media.title} : à partir de quel âge ? Est-il adapté aux enfants ?`

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

  const sensitivePoints: string[] = []
  if (media.contentMetrics.violence >= 3) sensitivePoints.push("violence")
  if (media.contentMetrics.sexNudity >= 3) sensitivePoints.push("sexe ou nudité")
  if (media.contentMetrics.language >= 3) sensitivePoints.push("langage")
  if (media.contentMetrics.substanceUse >= 3) sensitivePoints.push("substances")
  if (media.contentMetrics.consumerism >= 3) sensitivePoints.push("consumérisme")

  const positivePoints: string[] = []
  if (media.contentMetrics.positiveMessages >= 4) positivePoints.push("messages positifs")
  if (media.contentMetrics.roleModels >= 4) positivePoints.push("modèles positifs")

  const sensitiveText = sensitivePoints.length > 0
    ? `Points à vérifier : ${sensitivePoints.join(", ")}.`
    : "Aucun signal sensible majeur ne ressort dans les dimensions principales."
  const positiveText = positivePoints.length > 0
    ? `Points favorables : ${positivePoints.join(", ")}.`
    : "Les apports positifs sont à lire dans l'analyse détaillée."

  return {
    question,
    answer: `${media.title} est un ${typeLabel} conseillé ${age} par Totem Avisé. ${sensitiveText} ${positiveText}`,
    age,
    sensitiveText,
    positiveText,
  }
}
