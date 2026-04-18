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

export const APERCU_AGE_BUCKETS = [
  { key: "2-4", maxAge: 4, label: "2–4", name: "Tout-petits", color: "#F4C7A6" },
  { key: "5-7", maxAge: 7, label: "5–7", name: "Enfants", color: "#F8D775" },
  { key: "8-10", maxAge: 10, label: "8–10", name: "Grands enfants", color: "#B8D89A" },
  { key: "11-12", maxAge: 12, label: "11–12", name: "Pré-ados", color: "#8DBDC9" },
  { key: "13-15", maxAge: 15, label: "13–15", name: "Ados", color: "#A79BC7" },
  { key: "16+", maxAge: 99, label: "16+", name: "Jeunes adultes", color: "#D89AB0" },
] as const

export function isFraunces(fontFlag: string | undefined): boolean {
  return fontFlag !== "poppins"
}
