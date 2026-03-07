import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Jeux Vidéo — Avis PEGI et âges recommandés",
  description: "Jeux vidéo adaptés à chaque âge : analyses PEGI, microtransactions, contenu en ligne et recommandations parentales.",
  alternates: { canonical: "/jeux" },
  openGraph: {
    title: "Jeux Vidéo — Avis PEGI et âges recommandés | Totem Avisé",
    description: "Jeux vidéo adaptés à chaque âge : analyses PEGI, microtransactions et recommandations parentales.",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
  },
}

export default function JeuxLayout({ children }: { children: React.ReactNode }) {
  return children
}
