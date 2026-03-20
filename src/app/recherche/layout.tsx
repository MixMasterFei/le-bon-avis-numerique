import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recherche — Trouvez le film, la série ou le jeu idéal",
  description: "Recherchez parmi des milliers de films, séries TV et jeux vidéo avec des recommandations d'âge et des analyses détaillées pour les familles.",
  alternates: { canonical: "/recherche" },
  openGraph: {
    title: "Recherche — Trouvez le contenu idéal | Totem Avisé",
    description: "Recherchez parmi des milliers de films, séries et jeux avec des recommandations d'âge pour les familles.",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
  },
}

export default function RechercheLayout({ children }: { children: React.ReactNode }) {
  return children
}
