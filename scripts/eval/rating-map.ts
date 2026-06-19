/**
 * Maps an official content rating (CSA / CNC / PEGI, in any of its stored
 * encodings) to a numeric minimum age — for the Plan B eval harness only.
 *
 * Encodings seen in the catalog: TOUS_PUBLICS / TP / U (all audiences),
 * CSA_10/12/16/18, bare numerics "12"/"16"/"18", and PEGI_3/7/12/16/18.
 */

const ALL_AUDIENCE = new Set(["TP", "U", "G", "TOUS_PUBLICS", "TOUS PUBLICS", "ALL", "ATP"])

export function officialToAge(raw: string | null | undefined): number | null {
  if (!raw) return null
  const r = raw.trim().toUpperCase()
  if (ALL_AUDIENCE.has(r)) return 0
  const digits = r.replace(/\D/g, "")
  if (digits.length > 0) {
    const n = parseInt(digits, 10)
    return Number.isNaN(n) ? null : n
  }
  return null // unmapped — caller should log it
}

/** Family of an official rating, for grouping the report. */
export function ratingSystem(raw: string | null | undefined): "PEGI" | "CSA" | "OTHER" {
  if (!raw) return "OTHER"
  const r = raw.trim().toUpperCase()
  if (r.startsWith("PEGI")) return "PEGI"
  if (r.startsWith("CSA") || ALL_AUDIENCE.has(r) || /^-?\d{1,2}$/.test(r)) return "CSA"
  return "OTHER"
}
