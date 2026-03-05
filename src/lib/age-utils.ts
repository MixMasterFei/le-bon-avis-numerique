/**
 * Age category utilities for family member display
 */

export interface AgeCategory {
  label: string
  color: string       // Tailwind text color class
  bgColor: string     // Tailwind bg color class
}

/**
 * Get the age category for a given age
 */
export function getAgeCategory(age: number): AgeCategory {
  if (age <= 3) return { label: "Tout-petit", color: "text-emerald-600", bgColor: "bg-emerald-100" }
  if (age <= 7) return { label: "Enfant", color: "text-green-600", bgColor: "bg-green-100" }
  if (age <= 12) return { label: "Pré-ado", color: "text-amber-600", bgColor: "bg-amber-100" }
  if (age <= 15) return { label: "Ado", color: "text-orange-600", bgColor: "bg-orange-100" }
  if (age <= 17) return { label: "Grand ado", color: "text-red-600", bgColor: "bg-red-100" }
  return { label: "Adulte", color: "text-gray-600", bgColor: "bg-gray-100" }
}

/**
 * Calculate member's age from birth year and optional birth month.
 * With birthMonth, returns precise age (accounts for whether birthday has passed this year).
 * Without birthMonth, falls back to year-only approximation.
 */
export function getMemberAge(birthYear: number | null, birthMonth?: number | null): number | null {
  if (!birthYear) return null
  const now = new Date()
  const currentYear = now.getFullYear()
  const yearDiff = currentYear - birthYear
  if (birthMonth != null && birthMonth >= 1 && birthMonth <= 12) {
    // Birthday hasn't happened yet this year → subtract 1
    const currentMonth = now.getMonth() + 1 // 1-indexed
    return currentMonth < birthMonth ? yearDiff - 1 : yearDiff
  }
  return yearDiff
}
