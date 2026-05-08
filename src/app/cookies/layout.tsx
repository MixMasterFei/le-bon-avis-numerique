import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gestion des cookies — Totem Avisé",
  description:
    "Gérez vos préférences de cookies sur Totem Avisé : cookies essentiels, mesure d'audience et préférences marketing.",
  alternates: { canonical: "/cookies" },
}

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children
}
