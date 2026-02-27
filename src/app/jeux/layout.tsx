import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Jeux vidéo pour enfants — Avis PEGI et âges recommandés",
  description: "Guide des jeux vidéo adaptés à chaque âge. Analyses PEGI, microtransactions, contenu en ligne et recommandations parentales pour choisir le bon jeu.",
}

export default function JeuxLayout({ children }: { children: React.ReactNode }) {
  return children
}
