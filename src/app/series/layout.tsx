import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Séries pour enfants — Avis et âges recommandés",
  description: "Découvrez les meilleures séries pour vos enfants avec nos analyses détaillées du contenu. Recommandations d'âge, avis de parents et critères de sensibilité.",
}

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children
}
