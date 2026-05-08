export interface CompletionMember {
  birthYear: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  useCustomSettings: boolean
  favoriteGenres: string[]
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  avoidTopics: string[]
  interests: string[]
}

export interface CompletionItem {
  label: string
  done: boolean
  weight: number
}

export function getCompletionItems(member: CompletionMember, reactionCount: number): CompletionItem[] {
  const defaults = [2, 2, 3, 2, 2]
  const current = [
    member.sensitivityViolence,
    member.sensitivityScary,
    member.sensitivitySexual,
    member.sensitivityLanguage,
    member.sensitivitySubstances,
  ]
  const sensitivityCustomized = current.some((v, i) => v !== defaults[i])
  const hasConfiguredPreferences = member.useCustomSettings && member.favoriteGenres.length > 0

  return [
    { label: "Ajouter l'année de naissance", done: member.birthYear !== null, weight: 10 },
    { label: "Choisir un avatar personnalisé", done: member.avatarStyle != null || member.avatarEmoji !== "👧", weight: 5 },
    { label: "Définir les préférences du quiz", done: hasConfiguredPreferences, weight: 25 },
    { label: "Personnaliser les niveaux de sensibilité", done: sensitivityCustomized, weight: 15 },
    { label: "Ajouter des thèmes à éviter", done: member.avoidTopics.length > 0, weight: 5 },
    { label: "Ajouter au moins 3 réactions", done: reactionCount >= 3, weight: 15 },
    { label: "Ajouter au moins 5 réactions", done: reactionCount >= 5, weight: 10 },
    { label: "Ajouter des centres d'intérêt", done: member.interests.length > 0, weight: 15 },
  ]
}

export function getCompletionPercent(member: CompletionMember, reactionCount: number): number {
  return getCompletionItems(member, reactionCount).reduce(
    (sum, item) => sum + (item.done ? item.weight : 0),
    0,
  )
}

