import { mediaTypeLabels } from "@/lib/utils"
import type { MediaType } from "@/lib/media-route"

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
    question: `${media.title} est-il adapté aux enfants ?`,
    answer: `${media.title} est un ${typeLabel} conseillé ${age} par Totem Avisé. ${sensitiveText} ${positiveText}`,
    age,
    sensitiveText,
    positiveText,
  }
}
