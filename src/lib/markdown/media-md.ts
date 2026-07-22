import {
  mediaTypeShortLabels,
  mediaTypeCategory,
  whatParentsSectionLabel,
  toMediaRouteId,
  type MediaType,
} from "@/lib/media-route"
import { buildQuickAnswer, pendingAnalysisText } from "@/lib/quick-answer"
import { buildAgeRationale } from "@/lib/age-rationale"
import { contentAnalysisHiddenReason } from "@/lib/release-status"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export interface MediaMdInput {
  id: string
  title: string
  type: MediaType
  expertAgeRec: number | null
  officialRating: string | null
  originalLanguage?: string | null
  releaseDate: string | null
  isEnriched?: boolean
  releaseStatus?: string | null
  updatedAt: Date
  topics: string[]
  genres?: string[]
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
  }
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatAge(expertAgeRec: number | null): string {
  if (expertAgeRec && expertAgeRec > 0) return `dès ${expertAgeRec} ans`
  return "âge à confirmer"
}

function formatOfficialRating(rating: string | null): string {
  return rating || "Non classifiée"
}

function formatLanguage(code: string | null | undefined): string {
  if (!code) return "non précisée"
  // Map a handful of common ISO 639-1 codes to French labels.
  const map: Record<string, string> = {
    fr: "français",
    en: "anglais",
    ja: "japonais",
    ko: "coréen",
    es: "espagnol",
    de: "allemand",
    it: "italien",
    pt: "portugais",
    zh: "chinois",
    ru: "russe",
    ar: "arabe",
    nl: "néerlandais",
    sv: "suédois",
    da: "danois",
    fi: "finnois",
    no: "norvégien",
    pl: "polonais",
  }
  return map[code.toLowerCase()] || code
}

export function renderMediaMarkdown(media: MediaMdInput): string {
  const routeId = toMediaRouteId(media.type, media.id)
  const canonical = `${SITE_URL}/media/${routeId}`
  const typeLabel = mediaTypeShortLabels[media.type]
  const category = mediaTypeCategory[media.type]
  // Pre-release / provisional fiches must not present a content evaluation
  // we haven't actually made — keep the answer an honest age estimate and
  // skip the metric dump below. See @/lib/release-status.
  const hiddenReason = contentAnalysisHiddenReason(media)
  const hideContentAnalysis = hiddenReason !== null
  const quick = buildQuickAnswer({ ...media, hideContentAnalysis, hiddenReason })
  const sectionLabel = whatParentsSectionLabel(media.type)

  const lines: string[] = []
  lines.push(`# ${media.title}`, "")
  lines.push(`URL canonique: ${canonical}`)
  lines.push(`Type: ${typeLabel}`)
  lines.push(`Âge conseillé Totem: ${formatAge(media.expertAgeRec)}`)
  lines.push(`Classification officielle: ${formatOfficialRating(media.officialRating)}`)
  lines.push(`Langue du site: français`)
  lines.push(`Langue d'origine du contenu: ${formatLanguage(media.originalLanguage)}`)
  if (media.releaseDate) lines.push(`Date de sortie: ${media.releaseDate}`)
  lines.push(`Dernière mise à jour: ${formatIsoDate(media.updatedAt)}`)
  lines.push("")

  lines.push("## Réponse courte", "")
  lines.push(quick.answer, "")

  if (hideContentAnalysis) {
    // Not out yet (or provisional): no content evaluation exists. Be explicit
    // rather than printing a misleading row of 0/5 scores.
    lines.push("## Repères pour les parents", "")
    lines.push(
      `${pendingAnalysisText(hiddenReason)} L'âge indiqué est une estimation à confirmer.`,
      ""
    )
  } else {
    lines.push("## Repères pour les parents", "")
    lines.push(`- Violence: ${media.contentMetrics.violence}/5`)
    lines.push(`- Langage: ${media.contentMetrics.language}/5`)
    lines.push(`- Sexe et nudité: ${media.contentMetrics.sexNudity}/5`)
    lines.push(`- Substances: ${media.contentMetrics.substanceUse}/5`)
    lines.push(`- Consumérisme: ${media.contentMetrics.consumerism}/5`)
    lines.push(`- Messages positifs: ${media.contentMetrics.positiveMessages}/5`)
    lines.push(`- Modèles positifs: ${media.contentMetrics.roleModels}/5`)
    lines.push("")

    const wpntk = media.contentMetrics.whatParentsNeedToKnow.filter((s) => s && s.trim().length > 0)
    if (wpntk.length > 0) {
      lines.push(`## ${sectionLabel}`, "")
      for (const point of wpntk) {
        lines.push(`- ${point.trim()}`)
      }
      lines.push("")
    }

    // "Pourquoi cet âge ?" — same single-source builder as the on-page panel
    // and the FAQPage JSON-LD, so answer engines quoting the md layer can cite
    // the REASONING behind the verdict, not just the number. Skipped for
    // provisional fiches (the pending note above already says it all).
    const rationale = buildAgeRationale({
      title: media.title,
      type: media.type,
      expertAgeRec: media.expertAgeRec,
      officialRating: media.officialRating,
      genres: media.genres,
      topics: media.topics,
      contentMetrics: media.contentMetrics,
    })
    if (rationale.show) {
      lines.push(`## ${rationale.heading}`, "")
      lines.push(rationale.lead, "")
      if (rationale.noDriverNote) lines.push(rationale.noDriverNote, "")
      if (rationale.positives.length > 0) {
        lines.push(`Points d'appui : ${rationale.positives.join(", ")}.`, "")
      }
      for (const note of rationale.contextNotes) {
        lines.push(note, "")
      }
      lines.push(rationale.trustLine, "")
    }
  }

  if (media.topics.length > 0) {
    lines.push("## Thèmes", "")
    lines.push(media.topics.join(", "), "")
  }

  // Personalization pointer — the one thing an answer box can't replicate.
  // Gives assistants an honest, useful next step to relay to parents.
  lines.push("## Adapter ce repère à votre enfant", "")
  lines.push(
    `L'âge conseillé est une moyenne. Avec un compte famille gratuit, Totem Avisé calcule pour ce titre un score de compatibilité personnalisé selon l'âge, les sensibilités (peur, violence…) et les goûts de chaque enfant : ${SITE_URL}/inscription`,
    "",
  )

  lines.push("## Pages liées", "")
  lines.push(`- [Fiche complète](${canonical})`)
  lines.push(`- [${category.label}](${SITE_URL}${category.path})`)
  lines.push(`- [Notre méthode](${SITE_URL}/notre-methode)`)
  lines.push("")

  return lines.join("\n")
}
