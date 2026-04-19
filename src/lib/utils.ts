import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// French translations for content metrics
export const contentMetricLabels: Record<string, string> = {
  violence: "Violence",
  sexNudity: "Sexe & Nudité",
  language: "Langage",
  consumerism: "Consumérisme",
  substanceUse: "Alcool & Drogues",
  positiveMessages: "Messages Positifs",
  roleModels: "Modèles de Rôle",
}

// Get color based on metric value (0-5 scale)
export function getMetricColor(value: number): string {
  if (value <= 1) return "bg-emerald-500" // Green - Safe
  if (value <= 3) return "bg-amber-500" // Yellow - Caution
  return "bg-red-500" // Red - High presence
}

export function getMetricColorText(value: number): string {
  if (value <= 1) return "text-emerald-600"
  if (value <= 3) return "text-amber-600"
  return "text-red-600"
}

// CSA ratings for movies/TV
export const csaRatings = [
  { value: "TOUS_PUBLICS", label: "Tous publics", color: "bg-green-500" },
  { value: "CSA_10", label: "-10", color: "bg-yellow-500" },
  { value: "CSA_12", label: "-12", color: "bg-orange-500" },
  { value: "CSA_16", label: "-16", color: "bg-red-500" },
  { value: "CSA_18", label: "-18", color: "bg-red-700" },
]

// PEGI ratings for games
export const pegiRatings = [
  { value: "PEGI_3", label: "PEGI 3", color: "bg-green-500" },
  { value: "PEGI_7", label: "PEGI 7", color: "bg-green-600" },
  { value: "PEGI_12", label: "PEGI 12", color: "bg-yellow-500" },
  { value: "PEGI_16", label: "PEGI 16", color: "bg-orange-500" },
  { value: "PEGI_18", label: "PEGI 18", color: "bg-red-500" },
]

export function getOfficialRatingDisplay(rating: string | null, type: string) {
  if (!rating) return null
  
  if (type === "GAME") {
    return pegiRatings.find(r => r.value === rating)
  }
  return csaRatings.find(r => r.value === rating)
}

// Format date in French
export function formatDateFr(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * "il y a 3 min / 2 h / 4 j". Pass an explicit `now` from server-component
 * callers (captured once in the page) to keep the caller pure under React
 * 19's purity rule. Client callers can omit it — the fallback lives inside
 * this utility, hidden from the component purity lint.
 */
export function formatRelativeTimeFr(
  date: Date | string | null | undefined,
  options?: { now?: number; prefix?: boolean },
): string {
  if (!date) return "jamais"
  const d = typeof date === "string" ? new Date(date) : date
  const now = options?.now ?? Date.now()
  const prefix = options?.prefix !== false // default true
  const diff = Math.max(0, now - d.getTime())
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "à l'instant"
  const label =
    mins < 60 ? `${mins} min` :
    mins < 24 * 60 ? `${Math.floor(mins / 60)} h` :
    `${Math.floor(mins / (24 * 60))} j`
  return prefix ? `il y a ${label}` : label
}

// Media type labels in French
export const mediaTypeLabels: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série TV",
  GAME: "Jeu Vidéo",
  BOOK: "Livre",
  APP: "Application",
}

/**
 * Format approximate age from birth year.
 * Since we only store the year (not month/day), the person could be
 * either (currentYear - birthYear - 1) or (currentYear - birthYear).
 * Returns a range like "9–10 ans" to always be accurate.
 */
export function formatAgeFromBirthYear(birthYear: number, birthMonth?: number | null): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  if (birthMonth != null && birthMonth >= 1 && birthMonth <= 12) {
    const currentMonth = now.getMonth() + 1
    const age = currentMonth < birthMonth ? currentYear - birthYear - 1 : currentYear - birthYear
    return `${age} ans`
  }
  const ageMax = currentYear - birthYear
  const ageMin = ageMax - 1
  return `${ageMin}–${ageMax} ans`
}
















