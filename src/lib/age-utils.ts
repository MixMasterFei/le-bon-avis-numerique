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
  return { label: "Grand ado", color: "text-red-600", bgColor: "bg-red-100" }
}

/**
 * Calculate member's age from birth year
 */
export function getMemberAge(birthYear: number | null): number | null {
  if (!birthYear) return null
  return new Date().getFullYear() - birthYear
}
