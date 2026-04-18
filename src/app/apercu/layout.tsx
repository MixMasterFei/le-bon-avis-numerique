import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aperçu — Totem Avisé",
  description: "Aperçu interne du design v2 — non public.",
  robots: { index: false, follow: false },
}

export default function ApercuLayout({ children }: { children: React.ReactNode }) {
  return children
}
