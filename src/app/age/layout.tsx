import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contenus par tranche d'âge — Recommandations famille",
  description: "Explorez les films, séries et jeux recommandés pour chaque tranche d'âge. Des contenus sélectionnés et analysés pour les familles françaises.",
}

export default function AgeLayout({ children }: { children: React.ReactNode }) {
  return children
}
