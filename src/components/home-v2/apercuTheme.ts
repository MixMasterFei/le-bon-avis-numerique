export const APERCU_PALETTE = {
  bg: "#F5F1E9",
  bg2: "#EDE7DA",
  card: "#FFFFFF",
  ink: "#1E1A15",
  ink2: "rgba(30,26,21,0.60)",
  accent: "#D16A4A",
  accent2: "#5C8A5C",
  line: "rgba(30,26,21,0.08)",
  line2: "rgba(30,26,21,0.15)",
  placeholder: "#E6DFCE",
} as const

// Each bucket carries the content-metric caps appropriate to the age.
// 0-5 scale per ContentMetrics table. The 16+ bucket has no caps since
// adult viewers can handle anything.
export interface ApercuAgeBucket {
  key: string
  maxAge: number
  label: string
  name: string
  color: string
  caps: {
    maxViolence?: number
    maxSexual?: number
    maxLanguage?: number
    maxSubstance?: number
  }
}

export const APERCU_AGE_BUCKETS: ApercuAgeBucket[] = [
  { key: "2-4", maxAge: 4, label: "2–4", name: "Tout-petits", color: "#F4C7A6", caps: { maxViolence: 0, maxSexual: 0, maxLanguage: 0, maxSubstance: 0 } },
  { key: "5-7", maxAge: 7, label: "5–7", name: "Enfants", color: "#F8D775", caps: { maxViolence: 1, maxSexual: 0, maxLanguage: 1, maxSubstance: 0 } },
  { key: "8-10", maxAge: 10, label: "8–10", name: "Grands enfants", color: "#B8D89A", caps: { maxViolence: 2, maxSexual: 1, maxLanguage: 1, maxSubstance: 1 } },
  { key: "11-12", maxAge: 12, label: "11–12", name: "Pré-ados", color: "#8DBDC9", caps: { maxViolence: 2, maxSexual: 1, maxLanguage: 2, maxSubstance: 1 } },
  { key: "13-15", maxAge: 15, label: "13–15", name: "Ados", color: "#A79BC7", caps: { maxViolence: 3, maxSexual: 2, maxLanguage: 3, maxSubstance: 2 } },
  { key: "16+", maxAge: 99, label: "16+", name: "Jeunes adultes", color: "#D89AB0", caps: {} },
]

export function buildAgeBucketHref(bucket: ApercuAgeBucket): string {
  const params = new URLSearchParams({ maxAge: String(bucket.maxAge) })
  for (const [k, v] of Object.entries(bucket.caps)) {
    if (typeof v === "number") params.set(k, String(v))
  }
  return `/films?${params}`
}

export function isFraunces(fontFlag: string | undefined): boolean {
  return fontFlag !== "poppins"
}
