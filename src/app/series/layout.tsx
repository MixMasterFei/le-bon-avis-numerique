import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Séries TV — Avis et âges recommandés pour la famille",
  description: "Les meilleures séries TV pour votre famille : analyses de contenu, recommandations d'âge et avis de parents.",
  alternates: { canonical: "/series" },
  openGraph: {
    title: "Séries TV — Avis et âges recommandés pour la famille | Totem Avisé",
    description: "Les meilleures séries TV pour votre famille : analyses de contenu, recommandations d'âge et avis de parents.",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
  },
}

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children
}
