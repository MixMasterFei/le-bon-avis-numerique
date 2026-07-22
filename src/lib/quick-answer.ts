import { mediaTypeLabels } from "@/lib/utils"
import type { MediaType } from "@/lib/media-route"
import type { ContentAnalysisHiddenReason } from "@/lib/release-status"

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
  /**
   * WHY it's hidden — picks the wording. Omitting it yields neutral phrasing
   * that is true in both states, deliberately: a caller that forgets to pass
   * the reason must never end up telling a visitor that an already-released
   * film "sortira bientôt".
   */
  hiddenReason?: ContentAnalysisHiddenReason | null
}

/** Wording for each withheld-analysis state. Never say "sortie" unless it's true. */
export function pendingAnalysisText(
  reason: ContentAnalysisHiddenReason | null | undefined
): string {
  if (reason === "unreleased")
    return "L'évaluation détaillée du contenu sera publiée après sa sortie, une fois le titre visionné."
  if (reason === "awaiting-analysis")
    return "Le titre vient de sortir : notre analyse détaillée du contenu est en cours."
  return "L'analyse détaillée du contenu n'est pas encore disponible."
}

export interface QuickAnswer {
  question: string
  answer: string
  age: string
  sensitiveText: string
  positiveText: string
}

// Shared by the media detail page (FAQPage JSON-LD + hero block) and
// the /md/media/[id] route, so both renders give the same wording.
export function buildQuickAnswer(media: QuickAnswerInput): QuickAnswer {
  const typeLabel = mediaTypeLabels[media.type]?.toLowerCase() || "contenu"

  // Question phrased to match the dominant search intent ("à partir de quel
  // âge") while keeping the natural "adapté aux enfants" follow-up.
  const question = `${media.title} : à partir de quel âge ? Est-il adapté aux enfants ?`

  // Pre-release / provisional: honest estimate, no content claims.
  if (media.hideContentAnalysis) {
    const age = media.expertAgeRec && media.expertAgeRec > 0
      ? `à partir de ${media.expertAgeRec} ans (à confirmer)`
      : "à un âge encore à confirmer"
    const pending = pendingAnalysisText(media.hiddenReason)
    return {
      question,
      answer: `${media.title} est un ${typeLabel} dont l'âge est estimé ${age} par Totem Avisé. ${pending}`,
      age,
      sensitiveText: pending,
      positiveText: "",
    }
  }

  const age = media.expertAgeRec && media.expertAgeRec > 0
    ? `à partir de ${media.expertAgeRec} ans`
    : "avec un âge à confirmer"

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
