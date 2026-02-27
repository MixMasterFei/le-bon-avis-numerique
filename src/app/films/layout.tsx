import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Films pour enfants — Avis et âges recommandés",
  description: "Trouvez les meilleurs films pour vos enfants grâce à nos analyses détaillées : violence, langage, messages positifs. Recommandations d'âge par des experts et des parents.",
}

export default function FilmsLayout({ children }: { children: React.ReactNode }) {
  return children
}
