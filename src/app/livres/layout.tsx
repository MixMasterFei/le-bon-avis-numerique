import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Livres pour enfants — Avis et recommandations par âge",
  description: "Sélection de livres pour enfants et adolescents avec nos recommandations d'âge et analyses de contenu. Trouvez le livre idéal pour votre enfant.",
  // Without this, the page inherits the root layout's canonical "/" and
  // Google may merge it with the homepage in its index.
  alternates: { canonical: "/livres" },
}

export default function LivresLayout({ children }: { children: React.ReactNode }) {
  return children
}
