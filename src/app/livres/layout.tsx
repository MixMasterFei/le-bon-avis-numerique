import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Livres pour enfants — Avis et recommandations par âge",
  description: "Sélection de livres pour enfants et adolescents avec nos recommandations d'âge et analyses de contenu. Trouvez le livre idéal pour votre enfant.",
}

export default function LivresLayout({ children }: { children: React.ReactNode }) {
  return children
}
